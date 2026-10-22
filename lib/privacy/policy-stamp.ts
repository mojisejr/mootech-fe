// lib/privacy/policy-stamp.ts — ลายนิ้วมือของเนื้อหานโยบาย (CIEL mumate-pdpa-reconsent-001 slice 1).
// แยกจาก constants/privacy-policy.ts เพราะไฟล์นั้นถูก import ฝั่งเบราว์เซอร์ และ node:crypto ต้องไม่ไปถึงที่นั่น.
// นับเฉพาะ "เนื้อหา" (หัวเรื่อง คำนำ หมวด) ไม่นับ version/effectiveDate — ขึ้นรุ่นอย่างเดียวไม่ถือว่าเนื้อหาเปลี่ยน.
import { createHash } from 'node:crypto'
import { PRIVACY_POLICY, PRIVACY_POLICY_STAMP } from '@/constants/privacy-policy'

export function policyContentSha256(policy: { title: string; intro: string; sections: unknown } = PRIVACY_POLICY): string {
  const content = JSON.stringify({ title: policy.title, intro: policy.intro, sections: policy.sections })
  return createHash('sha256').update(content).digest('hex')
}

export type StampCheck =
  | { ok: true }
  | { ok: false; reason: 'content-changed' | 'version-not-stamped'; message: string }

/** เทียบเนื้อหา/รุ่นปัจจุบันกับ stamp — ไม่ตรง = คืนข้อความเตือน (ผู้เรียกพิมพ์แล้วไปต่อ ไม่ block) */
export function checkPolicyStamp(
  current: { version: string; sha256: string } = { version: PRIVACY_POLICY.version, sha256: policyContentSha256() },
  stamp: { version: string; sha256: string } = PRIVACY_POLICY_STAMP,
): StampCheck {
  if (current.version !== stamp.version) {
    return {
      ok: false,
      reason: 'version-not-stamped',
      message: `นโยบายขึ้นรุ่นเป็น ${current.version} แล้ว แต่ stamp ยังเป็น ${stamp.version} — รัน npx tsx scripts/check-policy-version.ts --stamp`,
    }
  }
  if (current.sha256 !== stamp.sha256) {
    return {
      ok: false,
      reason: 'content-changed',
      message: `ข้อความนโยบายเปลี่ยน แต่รุ่น PDPA ยังเป็น ${current.version} — เปลี่ยนสาระ: ขึ้น version + effectiveDate · แค่แก้คำ: --stamp อย่างเดียว (constants/privacy-policy.ts)`,
    }
  }
  return { ok: true }
}
