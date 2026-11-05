import { Github, RefreshCw, ExternalLink } from 'lucide-react'
import type { GitHubAuthStatus, GitHubDeviceLogin } from '../../types'

/** Account row: signed-in account, pending check, device code or sign-in button. */
export function GithubAuthBar({
  auth,
  deviceLogin,
  authBusy,
  onInstallApp,
  onLogout,
  onStartLogin,
  onCancelLogin,
}: {
  auth: GitHubAuthStatus | null
  deviceLogin: GitHubDeviceLogin | null
  authBusy: boolean
  onInstallApp: () => void
  onLogout: () => void
  onStartLogin: () => void
  onCancelLogin: () => void
}) {
  return (
    <div className="github-project-auth">
      {auth?.authenticated ? (
        <>
          <span className="github-project-avatar">
            {auth.avatarUrl ? <img src={auth.avatarUrl} alt="" /> : <Github size={16} />}
          </span>
          <span className="github-project-account">
            <small>ACCOUNT COLLEGATO</small>
            <strong>@{auth.login}</strong>
          </span>
          <button type="button" className="button button-quiet" onClick={onInstallApp}>
            Installa o gestisci app
          </button>
          <button type="button" className="button button-quiet" onClick={onLogout}>
            Esci
          </button>
        </>
      ) : auth === null ? (
        <span className="github-project-pending">
          <RefreshCw size={14} className="spin-icon" />
          Controllo accesso GitHub…
        </span>
      ) : !auth.configured ? (
        <span className="github-project-pending">L’accesso GitHub non è configurato in questa versione.</span>
      ) : deviceLogin ? (
        <>
          <span className="github-project-device">
            <small>INSERISCI IL CODICE SU GITHUB</small>
            <code>{deviceLogin.userCode}</code>
          </span>
          <button
            type="button"
            className="button button-dark"
            onClick={() => void window.cardCms.openGitHubDeviceLogin()}
          >
            <ExternalLink size={13} />
            Apri GitHub
          </button>
          <button type="button" className="text-button" onClick={onCancelLogin} disabled={authBusy}>
            Annulla
          </button>
        </>
      ) : (
        <>
          <span className="github-project-pending">Accedi per trovare repository accessibili a Card Studio.</span>
          <button type="button" className="button button-dark" onClick={onStartLogin} disabled={authBusy}>
            <Github size={14} />
            {authBusy ? 'Avvio…' : 'Accedi a GitHub'}
          </button>
        </>
      )}
    </div>
  )
}
