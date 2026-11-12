/**
 * Browser half of the session-delete bundle.
 *
 * Adds "Delete session" to the Session row menu and asks for confirmation in a
 * frame-wide dialog. The operation itself lives in the Host half; the Client
 * module lane has no generated Remote namespace, so the dialog calls the
 * package-private route with the same-origin fetch API.
 *
 * @module dsh-session-delete/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-delete',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'sessionDelete'
    const ENDPOINT = '/dsh-plugin/session-delete'

    const COPY = {
      en: {
        menuLabel: 'Delete session…',
        dialogTitle: 'Delete session',
        dialogBody: 'Permanently delete the conversation "{title}" and its local session record. This cannot be undone.',
        untitled: 'Untitled session',
        dialogHint: 'A running turn, subagent, background job, or scheduled task blocks deletion. The page reloads once the record is gone.',
        cancel: 'Cancel',
        confirm: 'Delete',
        deleting: 'Deleting…',
        done: 'Deleted. Reloading…',
        errActive: 'This session still has running work (a turn, subagent, background job, or scheduled task). Stop it first, then delete.',
        errRunning: 'This session is replying right now. Stop it first, then delete.',
        errNotFound: 'That session no longer exists.',
        errUnsupported: 'Session persistence is not mounted in this build, so there is nothing to delete.',
        errForbidden: 'The request was rejected by the origin check.',
        errUnreachable: 'The delete endpoint is not reachable from this page. Use the Web GUI (http), not the desktop file:// shell.',
        errRequest: 'The request was not valid. Try again.',
        errDeleteFailed: 'Deletion failed and the session record was not fully removed.',
        errGeneric: 'Deletion failed. Try again in a moment.',
      },
      zh: {
        menuLabel: '删除会话…',
        dialogTitle: '删除会话',
        dialogBody: '将永久删除会话「{title}」及其本地会话记录，且无法恢复。',
        untitled: '未命名会话',
        dialogHint: '进行中的对话、子代理、后台任务或定时任务会阻止删除。删除完成后页面将刷新。',
        cancel: '取消',
        confirm: '删除',
        deleting: '正在删除…',
        done: '已删除，正在刷新…',
        errActive: '该会话仍有运行中的工作（对话、子代理、后台任务或定时任务），请先停止后再删除。',
        errRunning: '该会话正在回复，请先停止后再删除。',
        errNotFound: '找不到该会话，可能已被删除。',
        errUnsupported: '当前部署未启用会话持久化，无法删除。',
        errForbidden: '请求被来源校验拒绝。',
        errUnreachable: '当前页面无法访问删除接口，请在 Web GUI（http）中使用。',
        errRequest: '请求无效，请重试。',
        errDeleteFailed: '删除失败，会话记录未完全移除。',
        errGeneric: '删除失败，请稍后重试。',
      },
    }

    const FAILURE_KEYS = {
      active: 'errActive',
      running: 'errRunning',
      'not-found': 'errNotFound',
      unsupported: 'errUnsupported',
      forbidden: 'errForbidden',
      method: 'errRequest',
      'bad-request': 'errRequest',
      'content-type': 'errRequest',
      unreachable: 'errUnreachable',
      'delete-failed': 'errDeleteFailed',
      'archive-failed': 'errDeleteFailed',
      'stat-failed': 'errGeneric',
      internal: 'errGeneric',
    }

    const styles = {
      menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box',
        margin: 0,
        padding: '7px 10px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--dsw-alias-state-error-primary)',
        font: 'inherit',
        fontSize: '13px',
        lineHeight: '1.35',
        textAlign: 'left',
        cursor: 'pointer',
      },
      backdrop: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '24px',
        background: 'rgba(0, 0, 0, 0.32)',
        pointerEvents: 'auto',
      },
      dialog: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: 'min(420px, 100%)',
        boxSizing: 'border-box',
        padding: '18px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-overlay)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: '0 18px 48px rgba(0, 0, 0, 0.28)',
        font: 'inherit',
      },
      title: {
        margin: 0,
        fontSize: '15px',
        lineHeight: '1.4',
        fontWeight: 600,
      },
      body: {
        margin: 0,
        fontSize: '13px',
        lineHeight: '1.6',
        color: 'var(--dsw-alias-label-secondary)',
        overflowWrap: 'anywhere',
      },
      hint: {
        margin: 0,
        fontSize: '12px',
        lineHeight: '1.5',
        color: 'var(--dsw-alias-label-secondary)',
      },
      error: {
        margin: 0,
        fontSize: '12px',
        lineHeight: '1.5',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '4px',
      },
      button: {
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
      },
      danger: {
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-state-error-primary)',
        background: 'var(--dsw-alias-state-error-primary)',
        color: '#ffffff',
        font: 'inherit',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
      },
      disabled: {
        opacity: 0.6,
        cursor: 'default',
      },
    }

    /** Confirmation request shared by the menu entry and the dialog. */
    let pending = null
    const listeners = new Set()

    function setPending(next) {
      pending = next
      for (const listener of [...listeners]) {
        try {
          listener()
        } catch (error) {
          console.error('[session-delete] subscriber failed', error)
        }
      }
    }

    function usePending() {
      const [, force] = React.useState(0)
      React.useEffect(() => {
        const listener = () => force((value) => value + 1)
        listeners.add(listener)
        return () => listeners.delete(listener)
      }, [])
      return pending
    }

    /**
     * Ask the Host half to delete one Session.
     * @param {string} sessionId Exact Session identity.
     * @returns {Promise<Record<string, unknown>>} Host result.
     */
    async function requestDelete(sessionId) {
      let response
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'content-type': 'application/json',
            'x-dsh-plugin': 'session-delete',
          },
          body: JSON.stringify({ sessionId }),
        })
      } catch (error) {
        const failure = new Error('The delete endpoint is unreachable from this page')
        failure.code = 'unreachable'
        throw failure
      }
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (payload === null || typeof payload !== 'object') {
        const failure = new Error(`Unexpected response (HTTP ${response.status})`)
        failure.code = 'internal'
        throw failure
      }
      return payload
    }

    function TrashIcon(props) {
      const size = props && props.size ? props.size : 14
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
        style: { flex: 'none' },
      },
        h('path', { d: 'M4 7h16' }),
        h('path', { d: 'M9 7V5h6v2' }),
        h('path', { d: 'M6.5 7l1 11.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L18 7' }),
        h('path', { d: 'M10 11v5' }),
        h('path', { d: 'M14 11v5' }),
      )
    }

    /**
     * One Session row menu entry. Rendered by the sidebar's legacy menu seat,
     * which supplies `sessionId`, `displayTitle`, and `useMenuOpenState`.
     */
    function SessionDeleteMenuRow(props) {
      const translate = typeof props.t === 'function' ? props.t : props.translate
      const label = translate ? translate('menuLabel') : 'Delete session…'
      const sessionId = props.sessionId
      const title = props.displayTitle || ''
      const menuState = typeof props.useMenuOpenState === 'function'
        ? props.useMenuOpenState()
        : undefined
      const closeMenu = Array.isArray(menuState) ? menuState[1] : undefined
      return h('button', {
        type: 'button',
        role: 'menuitem',
        style: styles.menuItem,
        onMouseEnter: (event) => {
          event.currentTarget.style.background = 'var(--dsw-alias-bg-layer-2)'
        },
        onMouseLeave: (event) => {
          event.currentTarget.style.background = 'transparent'
        },
        onClick: (event) => {
          event.preventDefault()
          event.stopPropagation()
          if (typeof closeMenu === 'function') closeMenu(false)
          setPending({ sessionId, title })
        },
      }, h(TrashIcon, null), h('span', null, label))
    }

    /** Frame-wide confirmation dialog; renders nothing while no deletion is pending. */
    function SessionDeleteDialog(props) {
      const request = usePending()
      const translate = typeof props.t === 'function' ? props.t : props.translate
      const t = (key, values) => (translate ? translate(key, values) : key)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [done, setDone] = React.useState(false)
      const cancelRef = React.useRef(null)

      React.useEffect(() => {
        setBusy(false)
        setError(null)
        setDone(false)
      }, [request])

      React.useEffect(() => {
        if (request && cancelRef.current) cancelRef.current.focus()
      }, [request])

      React.useEffect(() => {
        if (!request) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || busy) return
          event.preventDefault()
          event.stopPropagation()
          setPending(null)
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
      }, [request, busy])

      if (!request) return null

      const close = () => {
        if (busy || done) return
        setPending(null)
      }

      const confirm = async () => {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
          const payload = await requestDelete(request.sessionId)
          if (payload.ok !== true) {
            const key = FAILURE_KEYS[payload.code] ?? 'errGeneric'
            setError(t(key))
            if (payload.message) console.error('[session-delete]', payload.message)
            return
          }
          setDone(true)
          window.setTimeout(() => window.location.reload(), 700)
        } catch (failure) {
          const key = FAILURE_KEYS[failure && failure.code] ?? 'errGeneric'
          setError(t(key))
          console.error('[session-delete]', failure)
        } finally {
          setBusy(false)
        }
      }

      const title = request.title || t('untitled')

      return h('div', {
        style: styles.backdrop,
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close()
        },
      },
        h('div', {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'dsh-session-delete-title',
          style: styles.dialog,
        },
          h('h2', { id: 'dsh-session-delete-title', style: styles.title }, t('dialogTitle')),
          h('p', { style: styles.body }, t('dialogBody', { title })),
          h('p', { style: styles.hint }, t('dialogHint')),
          error ? h('p', { role: 'alert', style: styles.error }, error) : null,
          done ? h('p', { role: 'status', style: styles.hint }, t('done')) : null,
          h('div', { style: styles.actions },
            h('button', {
              ref: cancelRef,
              type: 'button',
              style: busy || done ? { ...styles.button, ...styles.disabled } : styles.button,
              disabled: busy || done,
              onClick: close,
            }, t('cancel')),
            h('button', {
              type: 'button',
              style: busy || done ? { ...styles.danger, ...styles.disabled } : styles.danger,
              disabled: busy || done,
              onClick: confirm,
            }, busy ? t('deleting') : t('confirm')),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const translate = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, COPY), 'session-delete: dictionaries')

        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.menu.item',
          id: 'session-delete.menu',
          order: 550,
          locale: NS,
          inject: () => ({ translate }),
        }, SessionDeleteMenuRow))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'session-delete.dialog',
          order: 900,
          locale: NS,
          inject: () => ({ translate }),
        }, SessionDeleteDialog))
      },
    }
  },
})
