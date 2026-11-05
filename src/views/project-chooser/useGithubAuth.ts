import { useState, useEffect } from 'react'
import type { GitHubAuthStatus, GitHubDeviceLogin } from '../../types'

export const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

/** GitHub auth status plus the device-flow login (start, poll, cancel). */
export function useGithubAuth() {
  const [auth, setAuth] = useState<GitHubAuthStatus | null>(null)
  const [deviceLogin, setDeviceLogin] = useState<GitHubDeviceLogin | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let active = true
    void window.cardCms
      .githubAuthStatus()
      .then((status) => {
        if (active) setAuth(status)
      })
      .catch((error) => {
        if (active) setAuthError(errorMessage(error, 'Impossibile controllare l’accesso GitHub.'))
      })
    return () => {
      active = false
    }
  }, [])
  useDeviceLoginPolling(deviceLogin, {
    onComplete: (status) => {
      setDeviceLogin(null)
      setAuth(status)
      setAuthError('')
    },
    onFailure: (message) => {
      setDeviceLogin(null)
      setAuthError(message)
    },
  })

  const startGithubLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    try {
      setDeviceLogin(await window.cardCms.githubStartLogin())
    } catch (error) {
      setAuthError(errorMessage(error, 'Impossibile avviare l’accesso GitHub.'))
    } finally {
      setAuthBusy(false)
    }
  }
  const cancelGithubLogin = async () => {
    setAuthBusy(true)
    try {
      await window.cardCms.githubCancelLogin()
      setDeviceLogin(null)
      setAuthError('')
    } catch (error) {
      setAuthError(errorMessage(error, 'Impossibile annullare l’accesso.'))
    } finally {
      setAuthBusy(false)
    }
  }
  const installGithubApp = async () => {
    try {
      await window.cardCms.openGitHubAppInstall()
    } catch (error) {
      setAuthError(errorMessage(error, 'Impossibile aprire la pagina della GitHub App.'))
    }
  }
  return {
    auth,
    setAuth,
    deviceLogin,
    authBusy,
    authError,
    setAuthError,
    startGithubLogin,
    cancelGithubLogin,
    installGithubApp,
  }
}

/** Polls the pending device login until it completes, expires or fails. */
function useDeviceLoginPolling(
  deviceLogin: GitHubDeviceLogin | null,
  handlers: { onComplete: (status: GitHubAuthStatus) => void; onFailure: (message: string) => void },
) {
  useEffect(() => {
    if (!deviceLogin) return
    let active = true
    let timer = 0
    let intervalSeconds = deviceLogin.intervalSeconds
    const poll = async () => {
      try {
        const result = await window.cardCms.githubPollLogin()
        if (!active) return
        if (result.status === 'complete') {
          handlers.onComplete(result.auth)
        } else if (result.status === 'expired') {
          handlers.onFailure('Codice scaduto o accesso annullato. Avvia un nuovo accesso.')
        } else {
          intervalSeconds = result.intervalSeconds ?? intervalSeconds
          timer = window.setTimeout(() => void poll(), intervalSeconds * 1000)
        }
      } catch (error) {
        if (active) {
          void window.cardCms.githubCancelLogin().catch(() => undefined)
          handlers.onFailure(errorMessage(error, 'Impossibile completare l’accesso GitHub.'))
        }
      }
    }
    timer = window.setTimeout(() => void poll(), intervalSeconds * 1000)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [deviceLogin])
}
