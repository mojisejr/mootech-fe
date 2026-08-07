// scripts/optimize-assets.ts — ย่อ + แปลงภาพ raw → .webp ที่ commit ได้ (goo · assets Phase 1).
//
//   assets-src/<sub>/x.{png,jpg,jpeg}  →  public/images/v2/<sub>/x.webp
//
// ย่อ **ฝั่งยาวสุด ≤ 800px** (fit inside 800×800 · ไม่ขยาย) · คง alpha · webp q82 / alphaQuality 100.
// 800px = จุดที่มาสคอตใหญ่สุดในแอป (onboarding paint 375 CSS px → ~750 @DSF2 · มุนวัดจริง e4e93eb).
//
// ⚠️ 2 กับดักที่จงใจเลี่ยง:
//   1) ชื่อไฟล์ห้ามลงท้าย .test.ts — ci.yml รัน `for f in scripts/*.test.ts` จะดูดไปรันเป็นเทสต์.
//   2) อ่านจาก REPO ROOT เสมอ (ไม่ใช่ cwd): assets-src/ ถูก gitignore → ไม่ตามเข้า worktree; ทุก path
//      resolve จาก __dirname/.. เพื่อให้รันจาก cwd ไหนก็ชี้ตำแหน่งเดียวกัน.
//
// ใช้: npm run assets:optimize            # ทั้ง assets-src/
//      npm run assets:optimize <path>     # เฉพาะไฟล์/โฟลเดอร์ (relative to repo root หรือ absolute)
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_ROOT = path.join(REPO_ROOT, 'assets-src')
const OUT_ROOT = path.join(REPO_ROOT, 'public/images/v2')
export const MAX_EDGE = 800
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg'])

/** Is this a file the optimizer will convert (vs skip)? Exported for the teeth test. */
export function isImage(file: string): boolean {
  return IMAGE_EXT.has(path.extname(file).toLowerCase())
}

/**
 * The one image transform, isolated so the test can exercise sharp on the CI runner (ubuntu) — the frame's
 * flagged trap: sharp is a NATIVE binary, "green on mac" ≠ "green on CI". Resize longest side ≤ MAX_EDGE
 * (no enlargement), emit webp, keep alpha crisp. Re-derives from the raw source, so re-running is idempotent.
 */
export async function convertToWebp(
  srcFile: string,
  outFile: string,
): Promise<{ inBytes: number; outBytes: number; w: number; h: number }> {
  await fs.mkdir(path.dirname(outFile), { recursive: true })
  const info = await sharp(srcFile)
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 100 })
    .toFile(outFile)
  const inBytes = (await fs.stat(srcFile)).size
  return { inBytes, outBytes: info.size, w: info.width, h: info.height }
}

type Result = { rel: string; out: string; inBytes: number; outBytes: number; w: number; h: number }

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name)
      return e.isDirectory() ? walk(full) : Promise.resolve([full])
    }),
  )
  return nested.flat()
}

/** assets-src/mascot/x.png → public/images/v2/mascot/x.webp (mirror the subpath, swap ext) */
function outPathFor(srcFile: string): string {
  const rel = path.relative(SRC_ROOT, srcFile)
  const noExt = rel.slice(0, rel.length - path.extname(rel).length)
  return path.join(OUT_ROOT, `${noExt}.webp`)
}

async function optimizeOne(srcFile: string): Promise<Result | null> {
  const relFromRoot = path.relative(REPO_ROOT, srcFile)
  if (!isImage(srcFile)) {
    console.log(`⏭️  skip (not an image): ${relFromRoot}`)
    return null
  }
  const out = outPathFor(srcFile)
  const info = await convertToWebp(srcFile, out) // idempotent: re-derives from the raw source each run
  const pct = Math.round((1 - info.outBytes / info.inBytes) * 100)
  console.log(
    `✅ ${relFromRoot}  ${(info.inBytes / 1024).toFixed(0)}KB → ${path.relative(REPO_ROOT, out)}  ` +
      `${(info.outBytes / 1024).toFixed(0)}KB  ${info.w}×${info.h}  (−${pct}%)`,
  )
  return { rel: relFromRoot, out, inBytes: info.inBytes, outBytes: info.outBytes, w: info.w, h: info.h }
}

async function main(): Promise<void> {
  const arg = process.argv[2]
  const target = arg ? (path.isAbsolute(arg) ? arg : path.join(REPO_ROOT, arg)) : SRC_ROOT
  let stat
  try {
    stat = await fs.stat(target)
  } catch {
    console.error(`❌ not found: ${target}`)
    console.error(`   assets-src/ อยู่ที่ repo root และ gitignored — วางภาพ raw ลงไปก่อน แล้วรันใหม่.`)
    process.exit(1)
  }
  const files = (stat.isDirectory() ? await walk(target) : [target]).sort()
  if (files.length === 0) {
    console.log('ℹ️  no files to process')
    return
  }
  const results: Result[] = []
  for (const f of files) {
    const r = await optimizeOne(f)
    if (r) results.push(r)
  }
  if (results.length) {
    const totIn = results.reduce((s, r) => s + r.inBytes, 0)
    const totOut = results.reduce((s, r) => s + r.outBytes, 0)
    console.log(
      `\n📦 ${results.length} image(s): ${(totIn / 1024 / 1024).toFixed(2)}MB → ` +
        `${(totOut / 1024 / 1024).toFixed(2)}MB  (−${Math.round((1 - totOut / totIn) * 100)}%)`,
    )
  }
}

// Run only when executed directly, so the *.test.ts can import convertToWebp/isImage without side effects.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(String(e?.message ?? e))
    process.exit(1)
  })
}
