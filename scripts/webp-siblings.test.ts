// scripts/webp-siblings.test.ts — scripts/webp-siblings.ts + the next.config.mjs rewrite it feeds
// (CIEL mumate-image-weight-001 slice 1).
//
// 🔴 MUTANT CONTRACT:
//   W1 drop an extension from SOURCE_RE (e.g. jpeg) → "every PNG/JPEG variant is a source" red
//   W2 resize or re-encode to the wrong format in writeTwin → "same pixels, WebP bytes" red
//   W3 the rewrite matches an extension the script does not twin (or the reverse) → "rewrite ⇔ script" red,
//      which in production would be a 404 for every such image
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listSources, SOURCE_RE, twinOf, writeTwin } from './webp-siblings'

let dir: string

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'webp-siblings-'))
  await fs.mkdir(path.join(dir, 'nested'))
  const png = await sharp({ create: { width: 40, height: 30, channels: 4, background: { r: 200, g: 10, b: 90, alpha: 0.5 } } })
    .png()
    .toBuffer()
  for (const name of ['a.png', 'nested/b.PNG', 'c.jpg', 'nested/d.jpeg', 'already.webp', 'note.txt']) {
    await fs.writeFile(path.join(dir, name), png)
  }
})

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('sources', () => {
  it.each(['x.png', 'x.PNG', 'x.jpg', 'x.JPG', 'x.jpeg', 'x.JPEG'])('every PNG/JPEG variant is a source: %s', (f) => {
    expect(SOURCE_RE.test(f)).toBe(true)
  })
  it.each(['x.webp', 'x.png.webp', 'x.svg', 'x.gif'])('%s is not a source', (f) => {
    expect(SOURCE_RE.test(f)).toBe(false)
  })
  it('walks nested folders and skips non-images', async () => {
    const rel = (await listSources(dir)).map((f) => path.relative(dir, f))
    expect(rel).toEqual(['a.png', 'c.jpg', 'nested/b.PNG', 'nested/d.jpeg'])
  })
})

describe('twin', () => {
  it('is named <file>.webp next to the source', () => {
    expect(twinOf('/x/images/a.png')).toBe('/x/images/a.png.webp')
  })
  it('same pixels, WebP bytes', async () => {
    const src = path.join(dir, 'a.png')
    const r = await writeTwin(src)
    expect(r.skipped).toBe(false)
    const meta = await sharp(twinOf(src)).metadata()
    expect(meta.format).toBe('webp')
    expect([meta.width, meta.height]).toEqual([40, 30])
    expect(meta.hasAlpha).toBe(true)
  })
  it('a twin newer than its source is not rewritten', async () => {
    const src = path.join(dir, 'c.jpg')
    await writeTwin(src)
    expect((await writeTwin(src)).skipped).toBe(true)
  })
})

describe('rewrite ⇔ script', () => {
  it('next.config.mjs rewrites exactly the extensions the script twins', async () => {
    const config = await fs.readFile(path.resolve(__dirname, '../next.config.mjs'), 'utf8')
    const groups = [...config.matchAll(/"\/images\/:path\(\.\*\\\\\.\(\?:([A-Za-z|]+)\)\)"/g)].map((m) => m[1])
    expect(groups.length).toBe(2) // the rewrite and the Vary header
    for (const g of groups) {
      const exts = g.split('|')
      for (const e of exts) expect(SOURCE_RE.test(`x.${e}`)).toBe(true)
      for (const e of ['png', 'PNG', 'jpg', 'JPG', 'jpeg', 'JPEG']) expect(exts).toContain(e)
    }
    expect(config).toContain('destination: "/images/:path.webp"')
  })
})
