// features/course/redeem.ts — โค้ด/ลิงก์รับคอร์ส (เอ็ม 2026-10-21): /course/redeem?code=<โค้ด>
// ยังไม่ล็อกอิน → จำโค้ดไว้ในเครื่อง → ล็อกอินเสร็จ (ตกที่ /v2) พากลับมาหน้ารับคอร์สเอง
export const COURSE_REDEEM_KEY = 'course:redeem-code'
export const REDEEM_CODE_RE = /^[A-Za-z0-9_-]{2,40}$/
