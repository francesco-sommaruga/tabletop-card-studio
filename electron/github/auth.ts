import { app, safeStorage, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { GitHubAuthStatus, GitHubDeviceLogin, GitHubLoginPollResult } from '../../src/types'
import { GITHUB_APP_CLIENT_ID, GITHUB_APP_SLUG } from '../github-config'
import { state } from '../state'
import { runGit, githubWebUrl } from '../git'

let pendingGithubLogin: { deviceCode: string; intervalSeconds: number; nextPollAt: number; expiresAt: number } | null =
  null

interface StoredGitHubCredential {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string
  refreshTokenExpiresAt: number
  userId: number
  login: string
  avatarUrl: string
}

interface GitHubOAuthResponse {
  device_code?: string
  user_code?: string
  verification_uri?: string
  interval?: number
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  error?: string
  error_description?: string
}

function githubCredentialPath() {
  return path.join(app.getPath('userData'), 'github-auth.json')
}

async function ensureGithubSecureStorage() {
  if (!(await safeStorage.isAsyncEncryptionAvailable()))
    throw new Error(
      'La cassaforte delle credenziali di sistema non è disponibile. Verifica che il portachiavi sia attivo e riprova.',
    )
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
    throw new Error('Card Studio non trova un portachiavi sicuro. Attiva GNOME Keyring o KWallet e riprova.')
}

async function readGithubCredential(): Promise<StoredGitHubCredential | null> {
  const file = githubCredentialPath()
  if (!existsSync(file)) return null
  await ensureGithubSecureStorage()
  const document = JSON.parse(await fs.readFile(file, 'utf8')) as { encrypted?: string }
  if (!document.encrypted) throw new Error('Le credenziali GitHub salvate non sono valide. Esci e accedi di nuovo.')
  const { result } = await safeStorage.decryptStringAsync(Buffer.from(document.encrypted, 'base64'))
  const credential = JSON.parse(result) as StoredGitHubCredential
  if (!credential.accessToken || !credential.login)
    throw new Error('Le credenziali GitHub salvate non sono valide. Esci e accedi di nuovo.')
  return credential
}

async function saveGithubCredential(credential: StoredGitHubCredential) {
  await ensureGithubSecureStorage()
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(credential))
  const file = githubCredentialPath()
  const temporaryFile = `${file}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(temporaryFile, JSON.stringify({ encrypted: encrypted.toString('base64') }), { mode: 0o600 })
  await fs.rename(temporaryFile, file)
}

export async function githubAuthStatus(): Promise<GitHubAuthStatus> {
  const status: GitHubAuthStatus = {
    configured: Boolean(GITHUB_APP_CLIENT_ID.trim() && GITHUB_APP_SLUG.trim()),
    authenticated: false,
    login: '',
    avatarUrl: '',
    appInstalled: false,
  }
  if (!status.configured) return status
  let credential: StoredGitHubCredential | null
  try {
    credential = await getFreshGithubCredential()
  } catch (error) {
    return { ...status, error: error instanceof Error ? error.message : String(error) }
  }
  if (!credential) return status
  const accountStatus = { ...status, authenticated: true, login: credential.login, avatarUrl: credential.avatarUrl }
  try {
    const response = await fetch('https://api.github.com/user/installations?per_page=100', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${credential.accessToken}`,
        'User-Agent': 'Tabletop Card Studio',
      },
    })
    if (!response.ok)
      throw new Error('Non riesco a verificare se Tabletop Card Studio è installata sul tuo account GitHub.')
    const installations = (await response.json()) as {
      installations?: Array<{ app_slug?: string; account?: { login?: string } }>
    }
    const remote = state.activeProject
      ? await runGit(['config', '--get', 'remote.origin.url']).catch(() => ({ stdout: '', stderr: '' }))
      : { stdout: '', stderr: '' }
    const repositoryUrl = githubWebUrl(remote.stdout)
    const targetAccount = repositoryUrl ? new URL(repositoryUrl).pathname.split('/')[1] : credential.login
    const appInstalled = Boolean(
      installations.installations?.some(
        (installation) =>
          installation.app_slug === GITHUB_APP_SLUG &&
          installation.account?.login?.toLocaleLowerCase() === targetAccount.toLocaleLowerCase(),
      ),
    )
    return { ...accountStatus, appInstalled }
  } catch (error) {
    return { ...accountStatus, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function startGithubLogin(): Promise<GitHubDeviceLogin> {
  if (!GITHUB_APP_CLIENT_ID.trim() || !GITHUB_APP_SLUG.trim())
    throw new Error(
      'Questa versione non è ancora configurata per l’accesso GitHub. Mancano Client ID e slug della GitHub App.',
    )
  await ensureGithubSecureStorage()
  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Tabletop Card Studio',
    },
    body: new URLSearchParams({ client_id: GITHUB_APP_CLIENT_ID.trim(), scope: 'offline_access' }),
  })
  const payload = (await response.json()) as GitHubOAuthResponse
  if (!response.ok || !payload.device_code || !payload.user_code || !payload.verification_uri || !payload.expires_in) {
    throw new Error(payload.error_description || payload.error || 'GitHub non ha avviato l’accesso. Riprova tra poco.')
  }
  const intervalSeconds = Math.max(5, payload.interval ?? 5)
  const expiresAt = Date.now() + payload.expires_in * 1000
  pendingGithubLogin = {
    deviceCode: payload.device_code,
    intervalSeconds,
    nextPollAt: Date.now() + intervalSeconds * 1000,
    expiresAt,
  }
  return { userCode: payload.user_code, verificationUri: payload.verification_uri, intervalSeconds, expiresAt }
}

export async function pollGithubLogin(): Promise<GitHubLoginPollResult> {
  const pending = pendingGithubLogin
  if (!pending || Date.now() >= pending.expiresAt) {
    pendingGithubLogin = null
    return { status: 'expired' }
  }
  if (Date.now() < pending.nextPollAt) return { status: 'pending' }
  pending.nextPollAt = Date.now() + pending.intervalSeconds * 1000
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Tabletop Card Studio',
    },
    body: new URLSearchParams({
      client_id: GITHUB_APP_CLIENT_ID.trim(),
      device_code: pending.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })
  const payload = (await response.json()) as GitHubOAuthResponse
  if (!response.ok) throw new Error(payload.error_description || payload.error || 'GitHub non ha completato l’accesso.')
  if (pendingGithubLogin !== pending) return { status: 'expired' }
  if (payload.error === 'authorization_pending') return { status: 'pending' }
  if (payload.error === 'slow_down') {
    pending.intervalSeconds += 5
    pending.nextPollAt = Date.now() + pending.intervalSeconds * 1000
    return { status: 'pending', intervalSeconds: pending.intervalSeconds }
  }
  if (payload.error === 'expired_token' || payload.error === 'access_denied') {
    pendingGithubLogin = null
    return { status: 'expired' }
  }
  if (!payload.access_token) {
    if (payload.error) {
      pendingGithubLogin = null
      throw new Error(payload.error_description || payload.error)
    }
    return { status: 'pending' }
  }
  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${payload.access_token}`,
      'User-Agent': 'Tabletop Card Studio',
    },
  })
  if (!profileResponse.ok) {
    pendingGithubLogin = null
    throw new Error('GitHub ha autorizzato l’app, ma non è stato possibile leggere il nome dell’account.')
  }
  const profile = (await profileResponse.json()) as { id?: number; login?: string; avatar_url?: string }
  if (pendingGithubLogin !== pending) return { status: 'expired' }
  if (!profile.login || !profile.id) {
    pendingGithubLogin = null
    throw new Error('GitHub ha restituito un profilo incompleto.')
  }
  await saveGithubCredential({
    accessToken: payload.access_token,
    accessTokenExpiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : Number.MAX_SAFE_INTEGER,
    refreshToken: payload.refresh_token ?? '',
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? Date.now() + payload.refresh_token_expires_in * 1000
      : Number.MAX_SAFE_INTEGER,
    userId: profile.id,
    login: profile.login,
    avatarUrl: profile.avatar_url ?? '',
  })
  pendingGithubLogin = null
  return { status: 'complete', auth: await githubAuthStatus() }
}

export async function getFreshGithubCredential(): Promise<StoredGitHubCredential | null> {
  const credential = await readGithubCredential()
  if (!credential) return null
  if (credential.accessTokenExpiresAt > Date.now() + 60_000) return credential
  if (!credential.refreshToken || credential.refreshTokenExpiresAt <= Date.now()) {
    await fs.rm(githubCredentialPath(), { force: true })
    throw new Error('La sessione GitHub è scaduta. Accedi di nuovo dall’app.')
  }
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Tabletop Card Studio',
    },
    body: new URLSearchParams({
      client_id: GITHUB_APP_CLIENT_ID.trim(),
      grant_type: 'refresh_token',
      refresh_token: credential.refreshToken,
    }),
  })
  const payload = (await response.json()) as GitHubOAuthResponse
  if (!response.ok || !payload.access_token) {
    if (payload.error === 'bad_refresh_token' || payload.error === 'invalid_grant')
      await fs.rm(githubCredentialPath(), { force: true })
    throw new Error(
      payload.error_description ||
        (payload.error ? `GitHub: ${payload.error}` : 'Non riesco a rinnovare la sessione GitHub. Accedi di nuovo.'),
    )
  }
  const refreshed: StoredGitHubCredential = {
    ...credential,
    accessToken: payload.access_token,
    accessTokenExpiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : Number.MAX_SAFE_INTEGER,
    refreshToken: payload.refresh_token ?? credential.refreshToken,
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? Date.now() + payload.refresh_token_expires_in * 1000
      : credential.refreshTokenExpiresAt,
  }
  await saveGithubCredential(refreshed)
  return refreshed
}

export async function cancelGithubLogin() {
  pendingGithubLogin = null
}

export async function logoutGithub() {
  pendingGithubLogin = null
  await fs.rm(githubCredentialPath(), { force: true })
  return githubAuthStatus()
}

export async function openGitHubAppInstall() {
  if (!/^[a-z\d-]+$/i.test(GITHUB_APP_SLUG))
    throw new Error('Lo slug della GitHub App non è configurato correttamente.')
  await shell.openExternal(`https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`)
}
