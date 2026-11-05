import { useState, useEffect } from 'react'
import type { GitHubAuthStatus, GitHubDeviceLogin } from '../../types'
import type { GitHubPageProps } from './types'

type AuthCallbacks = Pick<
  GitHubPageProps,
  | 'onAuthChange'
  | 'onGithubLoginStart'
  | 'onGithubLoginPoll'
  | 'onGithubLoginCancel'
  | 'onGithubLogout'
  | 'onOpenGithubLogin'
  | 'onOpenGithubInstall'
>

/** Device-flow login state: start, poll until complete/expired, cancel, logout. */
export function useGitHubAuth({
  onAuthChange,
  onGithubLoginStart,
  onGithubLoginPoll,
  onGithubLoginCancel,
  onGithubLogout,
  onOpenGithubLogin,
  onOpenGithubInstall,
}: AuthCallbacks) {
  const [deviceLogin, setDeviceLogin] = useState<GitHubDeviceLogin | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  useEffect(() => {
    if (!deviceLogin) return
    let active = true
    let timer = 0
    let intervalSeconds = deviceLogin.intervalSeconds
    const poll = async () => {
      try {
        const result = await onGithubLoginPoll()
        if (!active) return
        if (result.status === 'complete') {
          setDeviceLogin(null)
          onAuthChange(result.auth)
          setAuthNotice(`Accesso effettuato come @${result.auth.login}.`)
          setAuthError('')
        } else if (result.status === 'expired') {
          setDeviceLogin(null)
          setAuthError('Codice scaduto o accesso annullato. Avvia un nuovo accesso.')
        } else {
          intervalSeconds = result.intervalSeconds ?? intervalSeconds
          timer = window.setTimeout(() => void poll(), intervalSeconds * 1000)
        }
      } catch (error) {
        if (active) {
          void onGithubLoginCancel().catch(() => undefined)
          setDeviceLogin(null)
          setAuthError(error instanceof Error ? error.message : 'Impossibile completare l’accesso GitHub.')
        }
      }
    }
    timer = window.setTimeout(() => void poll(), deviceLogin.intervalSeconds * 1000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [deviceLogin])
  const startGithubLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      setDeviceLogin(await onGithubLoginStart())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile avviare l’accesso GitHub.')
    } finally {
      setAuthBusy(false)
    }
  }
  const openGithubLogin = async () => {
    try {
      await onOpenGithubLogin()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile aprire GitHub nel browser.')
    }
  }
  const openGithubInstall = async () => {
    try {
      await onOpenGithubInstall()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile aprire la pagina di installazione GitHub.')
    }
  }
  const cancelGithubLogin = async () => {
    setAuthBusy(true)
    try {
      await onGithubLoginCancel()
      setDeviceLogin(null)
      setAuthNotice('Accesso annullato.')
      setAuthError('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile annullare l’accesso.')
    } finally {
      setAuthBusy(false)
    }
  }
  const logoutGithub = async () => {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      onAuthChange(await onGithubLogout())
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Impossibile uscire da GitHub.')
    } finally {
      setAuthBusy(false)
    }
  }
  return {
    deviceLogin,
    authBusy,
    authError,
    authNotice,
    startGithubLogin,
    openGithubLogin,
    openGithubInstall,
    cancelGithubLogin,
    logoutGithub,
  }
}

export type GitHubAuthState = ReturnType<typeof useGitHubAuth>

/** While signed in but the app is not installed, refresh status when the window regains focus. */
export function useRefreshAfterGithubInstall(auth: GitHubAuthStatus | null, onRefresh: () => Promise<void>) {
  useEffect(() => {
    if (!auth?.authenticated || auth.appInstalled) return
    let timer = 0
    const refreshAfterGithub = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void onRefresh(), 800)
    }
    window.addEventListener('focus', refreshAfterGithub)
    return () => {
      window.removeEventListener('focus', refreshAfterGithub)
      window.clearTimeout(timer)
    }
  }, [auth?.authenticated, auth?.appInstalled, onRefresh])
}
