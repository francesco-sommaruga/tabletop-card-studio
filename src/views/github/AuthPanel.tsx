import { RefreshCw, Github, ExternalLink, CircleAlert, Check } from 'lucide-react'
import type { GitHubAuthStatus } from '../../types'
import type { GitHubAuthState } from './useGitHubAuth'

function authTitle(auth: GitHubAuthStatus | null) {
  return auth?.authenticated
    ? `@${auth.login}`
    : auth === null
      ? 'Controllo accesso…'
      : auth.configured
        ? 'Accedi per sincronizzare'
        : 'Accesso da configurare'
}

function authDescription(auth: GitHubAuthStatus | null) {
  return auth?.authenticated
    ? auth.appInstalled
      ? 'Account collegato. Pull e push useranno il token custodito dall’app.'
      : 'Account collegato. Installa Card Studio per creare e caricare una repository; per repository già esistenti, selezionale durante l’installazione.'
    : auth === null
      ? 'Controllo se Card Studio è già collegata a GitHub.'
      : auth.configured
        ? 'Accedi a GitHub, poi installa Card Studio sull’account per autorizzare la creazione e il caricamento della repository. Le credenziali Git del computer non verranno usate.'
        : 'Imposta il Client ID e lo slug della GitHub App in electron/github-config.ts per abilitare l’accesso.'
}

function AuthActions({ auth, authState }: { auth: GitHubAuthStatus | null; authState: GitHubAuthState }) {
  const {
    deviceLogin,
    authBusy,
    startGithubLogin,
    openGithubLogin,
    openGithubInstall,
    cancelGithubLogin,
    logoutGithub,
  } = authState
  return auth?.authenticated ? (
    <div className="git-auth-actions">
      {auth.avatarUrl && <img className="git-auth-avatar" src={auth.avatarUrl} alt="" />}
      <button
        type="button"
        className="button button-quiet"
        onClick={() => void openGithubInstall()}
        disabled={authBusy}
      >
        {auth.appInstalled ? 'Gestisci installazione' : 'Installa app'}
      </button>
      <button
        type="button"
        className="button button-quiet"
        onClick={() => void logoutGithub()}
        disabled={authBusy}
        title="Rimuove l’accesso salvato su questo computer"
      >
        Esci
      </button>
    </div>
  ) : auth === null ? (
    <span className="git-auth-unavailable">Controllo…</span>
  ) : !auth.configured ? (
    <span className="git-auth-unavailable">Non configurato</span>
  ) : deviceLogin ? (
    <div className="git-device-code">
      <span>INSERISCI IL CODICE</span>
      <code>{deviceLogin.userCode}</code>
      <button type="button" className="button button-dark" onClick={() => void openGithubLogin()}>
        <ExternalLink size={13} />
        Apri GitHub
      </button>
      <button type="button" className="text-button" onClick={() => void cancelGithubLogin()} disabled={authBusy}>
        Annulla
      </button>
    </div>
  ) : (
    <button type="button" className="button button-dark" onClick={() => void startGithubLogin()} disabled={authBusy}>
      <Github size={15} />
      {authBusy ? 'Avvio…' : 'Accedi a GitHub'}
    </button>
  )
}

/** GitHub account panel (device-flow login) plus its pending/error/notice banners. */
export function AuthPanel({ auth, authState }: { auth: GitHubAuthStatus | null; authState: GitHubAuthState }) {
  const { deviceLogin, authError, authNotice } = authState
  return (
    <>
      <section className={`git-auth-panel ${auth?.authenticated ? 'is-connected' : ''}`}>
        <div className="git-auth-mark">
          <Github size={18} />
        </div>
        <div className="git-auth-copy">
          <span className="metric-label">ACCOUNT GITHUB</span>
          <strong>{authTitle(auth)}</strong>
          <p>{authDescription(auth)}</p>
        </div>
        <AuthActions auth={auth} authState={authState} />
      </section>
      {deviceLogin && (
        <div className="git-auth-pending">
          <RefreshCw size={13} className="spin-icon" />
          In attesa che confermi il codice su GitHub…
        </div>
      )}
      {(authError || auth?.error) && (
        <div className="git-error">
          <CircleAlert size={15} />
          <span>{authError || auth?.error}</span>
        </div>
      )}
      {authNotice && (
        <div className="git-auth-success">
          <Check size={14} />
          <span>{authNotice}</span>
        </div>
      )}
    </>
  )
}
