// scripts/check-policy-version.ts — เตือนเมื่อข้อความนโยบายเปลี่ยนแต่ยังไม่ได้ตัดสินเรื่องรุ่น (CIEL mumate-pdpa-reconsent-001).
//   npx tsx scripts/check-policy-version.ts           → พิมพ์ ⚠️ หนึ่งบรรทัดถ้าไม่ตรง · exit 0 เสมอ (เตือน ไม่ block)
//   npx tsx scripts/check-policy-version.ts --stamp   → บันทึก version + sha256 ปัจจุบันลง PRIVACY_POLICY_STAMP
// .githooks/pre-push เรียกแบบแรก. owner 2026-10-22: "ไม่ fix นะ หลวมๆ ... ให้เตือนเฉยๆ".
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRIVACY_POLICY } from '../constants/privacy-policy'
import { checkPolicyStamp, policyContentSha256 } from '../lib/privacy/policy-stamp'

const FILE = join(__dirname, '..', 'constants', 'privacy-policy.ts')
const STAMP_RE = /export const PRIVACY_POLICY_STAMP = \{ version: '[^']*', sha256: '[^']*' \} as const/

if (process.argv.includes('--stamp')) {
  const src = readFileSync(FILE, 'utf8')
  if (!STAMP_RE.test(src)) {
    console.error('check-policy-version: PRIVACY_POLICY_STAMP line not found — stamp not written')
    process.exit(1)
  }
  const line = `export const PRIVACY_POLICY_STAMP = { version: '${PRIVACY_POLICY.version}', sha256: '${policyContentSha256()}' } as const`
  writeFileSync(FILE, src.replace(STAMP_RE, line))
  console.log(`check-policy-version: stamped ${PRIVACY_POLICY.version}`)
} else {
  const r = checkPolicyStamp()
  if (!r.ok) console.warn(`⚠️  PDPA: ${r.message}`)
}
