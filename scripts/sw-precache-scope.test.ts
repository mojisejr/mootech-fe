// CIEL mumate-fe-db-resilience-001 slice 6: the service worker must not precache the whole public folder.
// Before this list existed every new browser context downloaded all of public/ (1,326 files, about 130 MB).
// This suite reads the same pattern list next.config.mjs hands to @serwist/next and checks it against the real
// public/ tree. It does not run a build: the built manifest is checked on the staging image.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
// plain .mjs module so next.config.mjs can import it too
import { PRECACHE_PUBLIC_PATTERNS } from '../lib/pwa/precache-public.mjs'

const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')
const patterns = PRECACHE_PUBLIC_PATTERNS as string[]

function walk(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    return e.isDirectory() ? walk(path.join(dir, e.name), rel) : [rel]
  })
}

// The only two shapes the list may use, so this matcher and the glob Serwist runs cannot disagree.
const FOLDER = /^([A-Za-z0-9_-]+)\/\*\*\/\*$/
const FILE = /^[A-Za-z0-9_.-]+$/
function matches(file: string): boolean {
  return patterns.some((p) => {
    const folder = FOLDER.exec(p)
    return folder ? file.startsWith(`${folder[1]}/`) : file === p
  })
}

const files = walk(publicDir).filter((f) => f !== 'sw.js' && f !== 'sw.js.map')
const precached = files.filter(matches)

describe('service worker precache scope', () => {
  it('uses only exact file names or "<folder>/**/*" patterns', () => {
    expect(patterns.length).toBeGreaterThan(0)
    for (const p of patterns) expect(FOLDER.test(p) || FILE.test(p), p).toBe(true)
  })

  it('leaves every image folder to on-demand loading', () => {
    const heavy = precached.filter((f) => /^(images|mascot|mumate-v2-assets)\//.test(f))
    expect(heavy).toEqual([])
    // the tree really does hold the images this list is leaving out
    expect(files.filter((f) => f.startsWith('images/')).length).toBeGreaterThan(100)
  })

  it('precaches less than one hundredth of the public folder by size', () => {
    const size = (list: string[]) => list.reduce((n, f) => n + fs.statSync(path.join(publicDir, f)).size, 0)
    expect(size(precached) * 100).toBeLessThan(size(files))
  })

  it('still precaches the web manifest and every icon it names', () => {
    expect(precached).toContain('manifest.json')
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8')) as {
      icons: { src: string }[]
    }
    expect(manifest.icons.length).toBeGreaterThan(0)
    for (const icon of manifest.icons) expect(precached, icon.src).toContain(icon.src.replace(/^\//, ''))
  })

  it('still precaches the icons the push handler shows', () => {
    const sw = fs.readFileSync(path.join(root, 'sw.ts'), 'utf8')
    const shown = [...sw.matchAll(/"(\/icons\/[^"]+)"/g)].map((m) => m[1])
    expect(shown.length).toBeGreaterThan(0)
    for (const icon of shown) expect(precached, icon).toContain(icon.replace(/^\//, ''))
  })

  it('is the list next.config.mjs gives to Serwist', () => {
    const config = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8')
    expect(config).toContain('globPublicPatterns: PRECACHE_PUBLIC_PATTERNS')
    expect(config).toContain('from "./lib/pwa/precache-public.mjs"')
  })
})
