// Builds THIRD_PARTY_NOTICES.txt for everything that ships inside the app:
// - renderer production dependencies (bundled by Vite)
// - main runtime dependencies + devDependencies that esbuild bundles into main.js
// - Electron (also shipped by electron-builder as LICENSE.electron.txt)
// - bundled fonts
// Usage: node tools/licenses/collect-notices.mjs <output-file>
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = process.argv[2]
if (!out) throw new Error('usage: collect-notices.mjs <output-file>')

// main: esbuild bundles these devDependencies into dist/main.js / vision.js
const MAIN_BUNDLED = ['ws', 'ini', 'comlink', '@wokwi/bmp-ts']

function readLock (dir) {
  return JSON.parse(readFileSync(path.join(root, dir, 'package-lock.json'), 'utf8')).packages
}

function closure (lock, names) {
  const seen = new Set()
  const stack = [...names]
  while (stack.length) {
    const name = stack.pop()
    if (seen.has(name)) continue
    const entry = lock[`node_modules/${name}`]
    if (!entry) continue
    seen.add(name)
    for (const dep of Object.keys(entry.dependencies ?? {})) stack.push(dep)
  }
  return seen
}

function licenseText (dir, name) {
  const pkgDir = path.join(root, dir, 'node_modules', name)
  if (!existsSync(pkgDir)) return null
  const file = readdirSync(pkgDir).find(f => /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i.test(f))
  return file ? readFileSync(path.join(pkgDir, file), 'utf8').trim() : null
}

const packages = new Map()
function add (dir, lock, name) {
  const entry = lock[`node_modules/${name}`]
  if (!entry || packages.has(name)) return
  let author = null
  const pkgJson = path.join(root, dir, 'node_modules', name, 'package.json')
  if (existsSync(pkgJson)) {
    const a = JSON.parse(readFileSync(pkgJson, 'utf8')).author
    author = typeof a === 'string' ? a : (a?.name ?? null)
  }
  const text = licenseText(dir, name) ??
    (author ? `${entry.license ?? 'UNKNOWN'} License\nCopyright (c) ${author}\n(license file not included in the package; see ${name} on npm)` : null)
  packages.set(name, { name, version: entry.version, license: entry.license ?? 'UNKNOWN', text })
}

const rLock = readLock('renderer')
const rDeps = Object.keys(JSON.parse(readFileSync(path.join(root, 'renderer/package.json'), 'utf8')).dependencies)
for (const name of closure(rLock, rDeps)) add('renderer', rLock, name)

const mLock = readLock('main')
const mDeps = Object.keys(JSON.parse(readFileSync(path.join(root, 'main/package.json'), 'utf8')).dependencies)
for (const name of closure(mLock, [...mDeps, ...MAIN_BUNDLED])) add('main', mLock, name)
add('main', mLock, 'electron')

const missing = [...packages.values()].filter(p => !p.text)
const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))

const FONTS = `Bundled fonts
-------------
Exo 2 (Exo2-*.ttf) - SIL Open Font License 1.1, Copyright (c) 2013 Natanael Gama
  https://openfontlicense.org
Marcellus SC (MarcellusSC-Regular.ttf) - SIL Open Font License 1.1

${readFileSync(path.join(root, 'renderer/src/assets/font/MarcellusSC-OFL.txt'), 'utf8').trim()}`

const parts = [
  'Unawakened PoE Trade - third-party notices',
  '==========================================',
  '',
  'This application includes the following third-party software.',
  'Each component is licensed under the terms shown below.',
  '',
  FONTS,
  ''
]
for (const p of sorted) {
  parts.push('-'.repeat(78), `${p.name}@${p.version} (${p.license})`, '-'.repeat(78))
  parts.push(p.text ?? `License: ${p.license} (license file not included in the package)`, '')
}
writeFileSync(path.resolve(out), parts.join('\n') + '\n')
console.log(`notices: ${sorted.length} packages, ${missing.length} without a license file -> ${out}`)
for (const p of missing) console.log(`  no license file: ${p.name}@${p.version} (${p.license})`)
