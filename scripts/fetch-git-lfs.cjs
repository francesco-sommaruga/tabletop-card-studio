// electron-builder `beforePack` hook: downloads a pinned, checksum-verified git-lfs
// into vendor/git-lfs/<os>-<arch>/, which the linux/mac `extraResources` ship as resources/git-lfs.
// Windows is skipped because Git for Windows already includes git-lfs.
// Manual run: node scripts/fetch-git-lfs.cjs <linux|mac> <x64|arm64>
const { execFileSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const VERSION = '3.7.1'
// From https://github.com/git-lfs/git-lfs/releases/download/v3.7.1/sha256sums.asc
const CHECKSUMS = {
  'git-lfs-linux-amd64-v3.7.1.tar.gz': '1c0b6ee5200ca708c5cebebb18fdeb0e1c98f1af5c1a9cba205a4c0ab5a5ec08',
  'git-lfs-linux-arm64-v3.7.1.tar.gz': '73a9c90eeb4312133a63c3eaee0c38c019ea7bfa0953d174809d25b18588dd8d',
  'git-lfs-darwin-amd64-v3.7.1.zip': 'b5b1b641c0648c83661fa9eda991cd3eff945264dabc2cdf411a80dfe7ec0970',
  'git-lfs-darwin-arm64-v3.7.1.zip': '76260fb34f4ee622ff0a66b857e5954aa49c7e343a92e57a1ec4a760618c94b2',
}
// electron-builder's Arch enum values
const BUILDER_ARCH = { 1: 'x64', 3: 'arm64' }

function assetName(builderOs, arch) {
  const lfsOs = { linux: 'linux', mac: 'darwin' }[builderOs]
  const lfsArch = { x64: 'amd64', arm64: 'arm64' }[arch]
  const name = lfsOs && lfsArch && `git-lfs-${lfsOs}-${lfsArch}-v${VERSION}${lfsOs === 'linux' ? '.tar.gz' : '.zip'}`
  if (!name || !CHECKSUMS[name]) throw new Error(`git-lfs: nessun binario previsto per ${builderOs}-${arch}`)
  return name
}

async function download(name) {
  const url = `https://github.com/git-lfs/git-lfs/releases/download/v${VERSION}/${name}`
  const response = await fetch(url).catch((error) => {
    throw new Error(`git-lfs: impossibile scaricare ${url}: ${error.cause?.message ?? error.message}`)
  })
  if (!response.ok) throw new Error(`git-lfs: download di ${url} fallito (HTTP ${response.status})`)
  const data = Buffer.from(await response.arrayBuffer())
  const actual = crypto.createHash('sha256').update(data).digest('hex')
  if (actual !== CHECKSUMS[name])
    throw new Error(`git-lfs: checksum di ${name} non valido (atteso ${CHECKSUMS[name]}, ottenuto ${actual})`)
  return data
}

function findFile(dir, fileName) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isFile() && entry.name === fileName) return full
    if (entry.isDirectory()) {
      const found = findFile(full, fileName)
      if (found) return found
    }
  }
  return undefined
}

async function fetchGitLfs(builderOs, arch) {
  const targetDir = path.join(__dirname, '..', 'vendor', 'git-lfs', `${builderOs}-${arch}`)
  const versionFile = path.join(targetDir, 'VERSION')
  if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8').trim() === VERSION) return
  const name = assetName(builderOs, arch)
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-lfs-'))
  try {
    const archive = path.join(workDir, name)
    fs.writeFileSync(archive, await download(name))
    execFileSync('tar', ['-xf', archive, '-C', workDir])
    const binary = findFile(workDir, 'git-lfs')
    if (!binary) throw new Error(`git-lfs: eseguibile non trovato in ${name}`)
    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.mkdirSync(targetDir, { recursive: true })
    fs.copyFileSync(binary, path.join(targetDir, 'git-lfs'))
    fs.chmodSync(path.join(targetDir, 'git-lfs'), 0o755)
    fs.writeFileSync(versionFile, `${VERSION}\n`)
    console.log(`git-lfs ${VERSION} pronto in ${targetDir}`)
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}

exports.default = async function beforePack(context) {
  const builderOs = { linux: 'linux', darwin: 'mac' }[context.electronPlatformName]
  if (!builderOs) return
  await fetchGitLfs(builderOs, BUILDER_ARCH[context.arch])
}

if (require.main === module) {
  fetchGitLfs(process.argv[2], process.argv[3]).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}
