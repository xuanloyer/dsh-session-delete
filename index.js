/**
 * Host half of the session-delete bundle.
 *
 * The Harness has no session-deletion capability: the persistence seam exposes
 * no delete, and the Workspace registry only archives. This plugin implements
 * the operation itself:
 *
 *   1. archive the Session through the Workspace registry, so the sidebar row
 *      disappears immediately and the archived-Session gate blocks any new
 *      model step for it;
 *   2. remove that Session's stored log files from its own session directory.
 *
 * The browser half calls `POST /dsh-plugin/session-delete` (the Client module
 * lane has no generated Remote namespace, so a package-private HTTP route is
 * the bridge).
 *
 * @module dsh-session-delete
 */

import { readdir, rm, rmdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/** Exact route served by the Host half; no shipped route owns this path. */
const ROUTE_PATH = '/dsh-plugin/session-delete'

/** Request bodies are tiny JSON documents. */
const MAX_BODY_BYTES = 16 * 1024

/**
 * One session log generation: `session.jsonl`, `session.v3.jsonl`, and the
 * Zstandard forms the default backend writes. Never a broader pattern, so a
 * session directory holding anything else keeps that file.
 */
const SESSION_FILE = /^session(\.[A-Za-z0-9]+)?\.jsonl(\.zstd)?$/

/** The per-session write lock file documented by the JSONL backend. */
const LOCK_FILE = 'session.lock'

export const inject = ['webServer']

/**
 * Register the package-private HTTP bridge.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 */
export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: (request, response) => {
        void handleRequest(ctx, request, response)
      },
    }),
    'session-delete: http route',
  )
}

/**
 * Answer one bridge request.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {import('node:http').IncomingMessage} request Raw request.
 * @param {import('node:http').ServerResponse} response Raw response.
 */
async function handleRequest(ctx, request, response) {
  try {
    if (request.method !== 'POST') {
      return sendJson(response, 405, { ok: false, code: 'method', message: 'POST required' })
    }
    if (!isSameOrigin(request)) {
      return sendJson(response, 403, { ok: false, code: 'forbidden', message: 'Cross-origin request rejected' })
    }
    const contentType = String(request.headers['content-type'] ?? '').toLowerCase()
    if (!contentType.startsWith('application/json')) {
      return sendJson(response, 415, { ok: false, code: 'content-type', message: 'application/json required' })
    }
    let body
    try {
      body = await readJsonBody(request)
    } catch (error) {
      return sendJson(response, 400, { ok: false, code: 'bad-request', message: messageOf(error) })
    }
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
    if (sessionId === '') {
      return sendJson(response, 400, { ok: false, code: 'bad-request', message: 'sessionId is required' })
    }
    const result = await deleteSession(ctx, sessionId, { dryRun: body?.dryRun === true })
    sendJson(response, result.ok ? 200 : statusOf(result.code), result)
  } catch (error) {
    ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)))
    if (response.headersSent) {
      response.destroy()
      return
    }
    sendJson(response, 500, { ok: false, code: 'internal', message: messageOf(error) })
  }
}

/**
 * Delete one Session: archive it, then remove its stored log.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {string} sessionId Exact Session identity.
 * @param {{ dryRun: boolean }} options `dryRun` reports the resolved storage
 * without archiving or deleting.
 * @returns {Promise<Record<string, unknown>>} JSON-safe result.
 */
async function deleteSession(ctx, sessionId, { dryRun }) {
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined) {
    return { ok: false, code: 'unsupported', message: 'Session persistence is not mounted' }
  }
  const registry = ctx.get('workspaceRegistry')
  const agent = ctx.get('agents')?.get(sessionId)

  let snapshot
  try {
    snapshot = await persistence.stat(sessionId)
  } catch (error) {
    return { ok: false, code: 'stat-failed', message: messageOf(error) }
  }
  const location = snapshot?.location
  const file = location !== undefined && location.kind === 'jsonl' ? location.path : undefined

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      sessionId,
      persisted: snapshot !== undefined,
      live: agent !== undefined,
      running: agent?.status === 'running',
      file: file ?? null,
      archiveAvailable: registry !== undefined,
    }
  }

  if (snapshot === undefined && agent === undefined) {
    return { ok: false, code: 'not-found', message: `Session ${sessionId} is neither live nor persisted` }
  }

  // Archive first: the row leaves the sidebar at once (the Workspace follow
  // stream carries the archived increment), and the archived gate rejects any
  // later step, so the log becomes quiescent before its files are removed.
  let archived = false
  if (registry !== undefined) {
    try {
      await registry.archiveSession(sessionId)
      archived = true
    } catch (error) {
      if (isActiveSessionError(error)) {
        return {
          ok: false,
          code: 'active',
          message: messageOf(error),
          activity: activityOf(error),
        }
      }
      return { ok: false, code: 'delete-failed', message: messageOf(error) }
    }
  }

  let removed = []
  if (file !== undefined) {
    try {
      removed = await removeSessionFiles(file)
    } catch (error) {
      // Leave the Session where the user can find it again.
      if (archived) {
        try {
          await registry?.unarchiveSession(sessionId)
          archived = false
        } catch {
          /* best effort */
        }
      }
      return { ok: false, code: 'delete-failed', message: messageOf(error) }
    }
  }

  return { ok: true, sessionId, archived, removedFiles: removed }
}

/**
 * Remove the log generations of one Session directory.
 *
 * The directory layout is documented by the shipped JSONL backend as
 * `<root>/--<normalized-cwd>--/<encoded-id>/` (or `_no-cwd/`), and only that
 * shape is accepted here. Files are matched by the session-log pattern, so an
 * unrelated file placed in the directory survives and keeps the directory.
 * @param {string} file Absolute path of the selected log generation.
 * @returns {Promise<string[]>} Removed file names.
 */
async function removeSessionFiles(file) {
  const directory = dirname(file)
  const project = dirname(directory)
  const projectName = basename(project)
  const structured = projectName === '_no-cwd'
    || (projectName.startsWith('--') && projectName.endsWith('--') && projectName.length >= 4)
  if (!structured || directory === project) {
    throw new Error(`Refusing to delete an unexpected session layout: ${file}`)
  }
  const removed = []
  for (const name of await readdir(directory)) {
    if (!SESSION_FILE.test(name) && name !== LOCK_FILE) continue
    await rm(join(directory, name), { force: true })
    removed.push(name)
  }
  try {
    await rmdir(directory)
  } catch {
    /* not empty, or already gone */
  }
  return removed
}

/**
 * Reject a browser request that another origin sent to the loopback listener.
 * A same-origin POST carries an `Origin` equal to its `Host`; a request without
 * one is a non-browser caller (the CLI), which the listener already admits.
 * @param {import('node:http').IncomingMessage} request Raw request.
 * @returns {boolean} Whether the request may proceed.
 */
function isSameOrigin(request) {
  const origin = request.headers.origin
  if (origin === undefined) return true
  const host = request.headers.host
  if (host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/**
 * Read and parse a bounded JSON body.
 * @param {import('node:http').IncomingMessage} request Raw request.
 * @returns {Promise<unknown>} Parsed body.
 */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Request body is not valid JSON'))
      }
    })
    request.on('error', (error) => reject(error))
  })
}

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} response Raw response.
 * @param {number} status HTTP status.
 * @param {Record<string, unknown>} payload JSON body.
 */
function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/**
 * Map a failure code to its HTTP status.
 * @param {unknown} code Failure code from the result.
 * @returns {number} HTTP status.
 */
function statusOf(code) {
  switch (code) {
    case 'bad-request':
    case 'content-type':
      return 400
    case 'forbidden':
      return 403
    case 'not-found':
      return 404
    case 'active':
      return 409
    case 'unsupported':
      return 501
    default:
      return 500
  }
}

/**
 * Whether a Workspace archive failure names running Session activity.
 * @param {unknown} error Archive failure.
 * @returns {boolean} True for a refused active Session.
 */
function isActiveSessionError(error) {
  return typeof error === 'object' && error !== null
    && ('activity' in error || error.name === 'WorkspaceActiveSessionError')
}

/**
 * Read the activity families of an active-Session refusal.
 * @param {unknown} error Archive failure.
 * @returns {unknown[] | undefined} Activity list.
 */
function activityOf(error) {
  if (typeof error === 'object' && error !== null && 'activity' in error) {
    return Array.isArray(error.activity) ? error.activity : undefined
  }
  return undefined
}

/**
 * Read a message from an unknown thrown value.
 * @param {unknown} error Thrown value.
 * @returns {string} Message text.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
