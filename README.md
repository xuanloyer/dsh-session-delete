# dsh-session-delete

Delete a conversation from the DeepSeek Harness sidebar — permanently, not just archive.

DeepSeek Harness keeps an append-only session log and ships **Archive** only: the persistence
seam has no delete operation, and the Workspace registry documents session deletion as a
separate, absent capability. This bundle adds the missing action to the Session row menu.

## Requirements

- DeepSeek Harness `0.2.2-rc.1` (checked through `engines.dsh`), Web GUI served over `http://`.
- A managed profile: this package is a bundle, so it installs through the plugin manager.

## Install

**Web UI** — open **Plugins → Add plugin** and enter the Git address of this repository:

```
https://github.com/xuanloyer/dsh-session-delete
```

**CLI** — from the installation that owns the profile:

```
dsh plugin --profile <profile> add https://github.com/xuanloyer/dsh-session-delete
```

**Local development** — point at this directory instead:

```
dsh plugin --profile <profile> add /absolute/path/to/dsh-session-delete
```

A Git install records the commit it was installed at. To upgrade, remove the bundle and
install it again; the Plugins page offers no in-place update for Git sources.

## Use

1. Hover a Session row in the sidebar and open its **…** menu.
2. Choose **Delete session…**.
3. Confirm in the dialog. The row disappears and the page reloads once the log is gone.

A Session with running work — an active turn, a subagent, a background job, or a scheduled
task — is refused with the list of that work. Stop it first and delete again.

## What it does

The Host half performs three steps:

1. **Archive** the Session through `ctx.workspaceRegistry.archiveSession()`. The row leaves
   the sidebar immediately, and the archived-Session gate rejects every later model step, so
   the log becomes quiescent before anything is touched.
2. **Remove its log files** — `session*.jsonl`, `session*.jsonl.zstd`, and `session.lock` —
   inside the Session's own directory. The directory layout is the one the shipped JSONL
   backend documents: `<root>/--<normalized-cwd>--/<session-id>/` or `<root>/_no-cwd/<session-id>/`.
   Anything else in the directory, and any directory that does not match that shape, is left
   alone and the operation fails instead of guessing.
3. **Remove the empty Session directory.**

The browser half is a Client module: it contributes the row-menu entry and a confirmation
dialog, and calls the Host through `POST /dsh-plugin/session-delete`. That route is a
package-private bridge — the Client module lane has no generated Remote namespace — and it
accepts only a same-origin `POST` with `application/json`.

The action is user-only. The bundle registers no agent tool, so a model cannot delete the
user's conversations; this matches how DeepSeek Harness exposes archive, rename, and fork.

## Limits

- **Log files only.** Attachments live in a content-addressed store shared by Sessions and are
  not deleted, and derived projection caches are left behind (they are inert once the Session
  is gone). The full-text search index reconciles itself from persistence on the next search.
- **The Session is archived first**, so its id stays in the profile's archived set. It is not
  reachable and not visible; workspace membership prunes it on the next mutation or restart.
- **Running work blocks deletion.** A turn, subagent, background job, or scheduled reminder
  must be stopped first.
- **The storage layout is checked.** If a future DeepSeek Harness release changes the session
  directory layout, the operation refuses rather than deleting the wrong files.
- **Web GUI only.** The Desktop `file://` shell cannot reach the HTTP bridge; the dialog
  reports that instead of failing silently.
- **The page reloads** after a successful delete, so unsent drafts in other Sessions are lost.
- Built and tested against `0.2.2-rc.1` on Windows. Other platforms follow the same documented
  layout, but the bundle is not otherwise tested there.

## Privacy

Everything happens locally. The bundle makes no network requests, sends no telemetry, and
reads only the profile's session storage that the operation targets.

## Development

There is no build step: `client.js` is a plain Client module served as-is, and `index.js` is
the Host half. Edit the files, reinstall the bundle, and reload the page.

```
node --check index.js
node --check client.js   # parse only; the file uses browser globals
pnpm pack                # inspect the published file list without publishing
```

## Uninstall

**Plugins → Installed plugins → dsh-session-delete → Remove**, or:

```
dsh plugin --profile <profile> remove dsh-session-delete
```

Removing the bundle removes the menu entry and the HTTP route. Sessions already deleted stay
deleted; Sessions that remain are untouched.

## License

MIT — see [LICENSE](LICENSE).
