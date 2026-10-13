// scripts/webp-siblings.ts — give every PNG/JPEG under public/images a WebP twin named <file>.webp
// (CIEL mumate-image-weight-001 slice 1).
//
//   public/images/v2/bg/BG01.png  →  public/images/v2/bg/BG01.png.webp
//
// WHY: production sends the PNG art at full weight (images.unoptimized, next.config.mjs) — 15.3 GB of static
// files in 4.5 days, the 14 heaviest PNGs 18 MB → 0.77 MB as WebP, no visible difference. Most image paths are
// built at run time (`/images/v2/characters/${n}...`), so renaming files in code would miss them. Instead the
// URL stays the same and next.config.mjs rewrites it to this twin when the browser's Accept says image/webp;
// everyone else (link-preview crawlers, old webviews) still gets the PNG from the same URL.
//
// The rewrite cannot check that a twin exists, so EVERY matched file must have one: this script writes all of
// them (even the rare tiny PNG that WebP makes bigger) and exits 1 if any is missing afterwards. The Dockerfile
// runs it before `npm run build`; the twins are build output (.gitignore), never committed.
//
// Same pixels as the source (no resize — layout cannot shift), q82 / alphaQuality 100 like
// scripts/optimize-assets.ts. Re-running skips twins newer than their source.
//
// ใช้: npx tsx scripts/webp-siblings.ts            # write missing/stale twins, then verify
//      npx tsx scripts/webp-siblings.ts --check    # verify only (exit 1 if a twin is missing)
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const IMAGES_ROOT = path.join(REPO_ROOT, 'public/images')
export const SOURCE_RE = /\.(png|jpe?g)$/i

export const twinOf = (file: string): string => `${file}.webp`

export async function listSources(dir: string = IMAGES_ROOT): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listSources(p)))
    else if (SOURCE_RE.test(entry.name)) out.push(p)
  }
  return out.sort()
}

export async function writeTwin(src: string): Promise<{ inBytes: number; outBytes: number; skipped: boolean }> {
  const out = twinOf(src)
  const inStat = await fs.stat(src)
  const outStat = await fs.stat(out).catch(() => null)
  if (outStat && outStat.mtimeMs >= inStat.mtimeMs) return { inBytes: inStat.size, outBytes: outStat.size, skipped: true }
  const info = await sharp(src).webp({ quality: 82, alphaQuality: 100 }).toFile(out)
  return { inBytes: inStat.size, outBytes: info.size, skipped: false }
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const sources = await listSources()
  let inBytes = 0
  let outBytes = 0
  let written = 0
  if (!checkOnly) {
    for (const src of sources) {
      const r = await writeTwin(src)
      inBytes += r.inBytes
      outBytes += r.outBytes
      if (!r.skipped) written++
    }
  }
  const missing: string[] = []
  for (const src of sources) {
    if (!(await fs.stat(twinOf(src)).catch(() => null))) missing.push(path.relative(REPO_ROOT, src))
  }
  if (missing.length) {
    console.error(`webp-siblings: ${missing.length} of ${sources.length} images have no .webp twin:\n  ${missing.join('\n  ')}`)
    process.exit(1)
  }
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
  console.log(
    checkOnly
      ? `webp-siblings: all ${sources.length} images have a twin`
      : `webp-siblings: ${sources.length} images, ${written} twins written · ${mb(inBytes)} MB → ${mb(outBytes)} MB`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
