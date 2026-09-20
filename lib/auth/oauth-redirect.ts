// lib/auth/oauth-redirect.ts
// เอ็ม 2026-09-20 (สมัครใหม่ด้วย LINE ครั้งแรกพัง — "เข้าสู่ระบบไม่สำเร็จ / รหัสอ้างอิง: undefined"):
// รอบก่อน (#723) เดาว่าเป็น cold-start race ของ fetch('/api/auth/providers') แล้วใส่ warm-up ก่อนเรียก
// signIn() — แต่ ขึ้น prod แล้ว "ยังเป็นแบบเดิม". สาเหตุจริง: next-auth client signIn() ยิง getProviders()
// (fetch /api/auth/providers → .json()) ก่อน "เสมอ" ถ้า fetch นั้นคืน null (พังใน LINE in-app webview
// ของเครื่องคนใหม่) มันเด้ง window.location.href = /api/auth/error แบบไม่มี query → core ของ next-auth
// เติมเป็น /auth/error?error=undefined → หน้าเราโชว์ "รหัสอ้างอิง: undefined". warm-up ช่วยไม่ได้เพราะ
// signIn() ยัง "ยิง getProviders() ซ้ำเอง" อยู่ดี และ providers ของ prod แข็งแรง (ยิงตรงได้ JSON ครบ) —
// จุดพังคือ client fetch ใน webview ไม่ใช่ endpoint.
//
// แก้เชิงลึก: "เลี่ยง getProviders ทั้งหมด" — เริ่ม OAuth ด้วย full-page form POST ตรงไป
// /api/auth/signin/<provider> (เส้นเดียวกับที่หน้า signin ในตัวของ next-auth มันโพสต์เอง) พร้อม
// csrfToken + callbackUrl → next-auth ตอบ 302 ไป OAuth provider แล้ว "เบราว์เซอร์เดินตามเอง" (navigation
// จริง ไม่ใช่ location.href หลัง fetch) ซึ่งทน webview กว่ามาก. เหลือ fetch จุดเดียวคือ /api/auth/csrf
// (GET ง่ายๆ + เซ็ต csrf cookie ให้ด้วย) ซึ่ง retry สั้นๆ ได้. ถ้า csrf พังจริงหลัง retry → fallback ไป
// signIn() เดิม (ไม่แย่ไปกว่าก่อนแก้). ไม่ได้ "rewrite" next-auth — เรายิง server endpoint ของมันตรงๆ
// แบบเดียวกับ built-in signin form ของมันเอง แค่ trigger ด้วย native form แทน client JS.

// next-auth ตั้ง basePath = /api/auth เป็นค่า default (config เราไม่ได้ย้าย) — hardcode ให้เส้นทางแน่นอน
// ไม่ต้องพึ่ง __NEXTAUTH ที่คำนวณจาก NEXTAUTH_URL ตอน build.
const AUTH_BASE = '/api/auth'

/**
 * ดึง csrfToken จาก /api/auth/csrf พร้อม retry สั้นๆ (เผื่อ cold-start webview). GET นี้ทั้งคืน token
 * และเซ็ต csrf cookie ให้ (double-submit) — จำเป็นต้องเรียกก่อน POST signin เพื่อให้ csrf ผ่าน.
 * คืน null เมื่อพลาดทุกรอบ (ให้ผู้เรียก fallback).
 */
export async function fetchCsrfToken(retries = 2, delayMs = 350): Promise<string | null> {
  for (let i = 0; i <= retries; i += 1) {
    try {
      const res = await fetch(`${AUTH_BASE}/csrf`, { credentials: 'same-origin' })
      if (res.ok) {
        const data = (await res.json()) as { csrfToken?: string }
        if (data && typeof data.csrfToken === 'string' && data.csrfToken) {
          return data.csrfToken
        }
      }
    } catch {
      /* เครือข่ายพลาด — ลองรอบถัดไป */
    }
    if (i < retries) await new Promise((r) => setTimeout(r, delayMs))
  }
  return null
}

/**
 * เริ่ม OAuth ด้วย full-page form POST → /api/auth/signin/<provider> (เลี่ยง getProviders ของ signIn()).
 * ถ้าดึง csrf ไม่ได้ → fallback ไป next-auth signIn() เดิม (พฤติกรรมไม่แย่ไปกว่าก่อนแก้).
 */
export async function startOAuthRedirect(provider: string, callbackUrl: string): Promise<void> {
  const csrfToken = await fetchCsrfToken()

  if (!csrfToken || typeof document === 'undefined') {
    // fallback: ยังพึ่ง client signIn() เดิม (กรณี csrf พังจริง หรือไม่มี DOM)
    const { signIn } = await import('next-auth/react')
    void signIn(provider, { callbackUrl })
    return
  }

  const form = document.createElement('form')
  form.method = 'post'
  form.action = `${AUTH_BASE}/signin/${encodeURIComponent(provider)}`
  form.style.display = 'none'

  const addField = (name: string, value: string) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  addField('csrfToken', csrfToken)
  addField('callbackUrl', callbackUrl)

  document.body.appendChild(form)
  form.submit()
}
