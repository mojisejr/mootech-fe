// Teeth for scripts/optimize-assets.ts (goo · assets Phase 1). Generates a real oversized PNG-with-alpha in
// a temp dir with sharp, then exercises the actual transform — so this ALSO proves sharp (a NATIVE binary)
// runs on the CI runner (ubuntu), the frame's flagged trap: "green on mac ≠ green on CI".
//
// Covers the brief's test cases:
//   1. .png → .webp, longest side ≤ 800px, smaller than the source        (what the tool promises)
//   2. a non-image file → skipped (isImage=false), never crashes           (users = the team; will happen)
//   3. running twice on the same source → byte-identical output            (it WILL be re-run)
// Run: npx tsx scripts/optimize-assets.test.ts
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { convertToWebp, isImage, MAX_EDGE } from './optimize-assets'

const dir = mkdtempSync(join(tmpdir(), 'optimize-assets-'))
let pass = 0
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
  console.log(`  ✓ ${name}`)
}

async function main() {
  // A portrait source LARGER than MAX_EDGE on both axes, WITH an alpha channel (like the mascots).
  const src = join(dir, 'src.png')
  await sharp({
    create: { width: 1200, height: 1600, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 0.6 } },
  })
    .png()
    .toFile(src)

  // CASE 1 — converts, clamps longest side to MAX_EDGE, shrinks
  const out = join(dir, 'out.webp')
  const r = await convertToWebp(src, out)
  ok('output is a real webp file', (await sharp(out).metadata()).format === 'webp')
  ok(`longest side clamped to ${MAX_EDGE} (${r.w}×${r.h})`, Math.max(r.w, r.h) === MAX_EDGE)
  ok('aspect ratio preserved (portrait stays portrait)', r.h > r.w)
  ok('output smaller than source', r.outBytes < r.inBytes)
  ok('alpha channel preserved', ((await sharp(out).metadata()).channels ?? 0) === 4)

  // a source SMALLER than MAX_EDGE must NOT be enlarged
  const small = join(dir, 'small.png')
  await sharp({ create: { width: 300, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toFile(small)
  const rs = await convertToWebp(small, join(dir, 'small.webp'))
  ok('does not enlarge a below-max source', rs.w === 300 && rs.h === 400)

  // CASE 2 — non-image files are recognised as skippable
  ok('non-image (.txt) is not treated as an image', isImage(join(dir, 'notes.txt')) === false)
  ok('.PNG (uppercase) is still an image', isImage(join(dir, 'X.PNG')) === true)

  // CASE 3 — idempotent: re-deriving from the same raw source gives byte-identical output
  const out2 = join(dir, 'out2.webp')
  await convertToWebp(src, out2)
  const [a, b] = await Promise.all([fs.readFile(out), fs.readFile(out2)])
  ok('re-running on the same source is byte-identical (idempotent)', a.equals(b))

  console.log(`✅ optimize-assets.test.ts — ${pass} assertions passed (sharp runs here; transform has teeth)`)
}

main()
  .catch((e) => {
    console.error(String((e as Error)?.stack ?? e))
    process.exitCode = 1
  })
  .finally(() => rmSync(dir, { recursive: true, force: true }))
