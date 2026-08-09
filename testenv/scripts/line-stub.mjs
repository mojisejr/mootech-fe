#!/usr/bin/env node
// line-stub.mjs — ตัวแทน LINE Messaging API สำหรับสนามซ้อม local (#231 Phase 3)
//
// ปัญหาที่มันแก้: mootech-be ต้องเรียก LINE `GET /profile/{userId}` เพื่อยืนยันตัวตนก่อนสร้าง user
// (user.service.ts registerOrLogin → lineMessageService.checkUserId) แต่ testenv ตั้ง
// LINE_HOST=https://line.invalid ไว้กันไม่ให้ยิงข้อความออกไปหาลูกค้าจริง
// ⇒ DNS ไม่มี ⇒ BE ตอบ {ok:false, reason:'LINE_ERROR'} ⇒ FE ล้าง cookie + signOut ⇒ เด้งกลับ onboarding
// ⇒ "ตันท่อเพื่อความปลอดภัย" ตัดขาการสมัครไปด้วย เพราะ login กับ ส่งข้อความ ใช้ host ตัวเดียวกัน
//
// 🔑 ทำไมถึงเลือก stub แทนการเปิดท่อจริง (ฟีมเคาะ 2026-08-09):
//    host เดียวกันนี้ยังถูกใช้โดย POST /message/multicast ซึ่ง cronjob.service.ts เรียกอัตโนมัติ
//    ทุก 06:00 และ 09:00 น. (ScheduleModule.forRoot() เปิดอยู่)
//    เปิดท่อจริง = ด่านเดียวที่กันไว้คือ "id_token ในตารางว่างหมดเพราะ anonymize" ซึ่งเป็น *ข้อมูล*
//    ไม่ใช่ *โครงสร้าง* — วันที่มีคน seed ข้อมูลใหม่ ด่านนั้นหายไปเงียบ ๆ
//    stub ปฏิเสธ /message/* เชิงโครงสร้าง ⇒ ต่อให้มีเป้า ก็ยิงออกไม่ได้
//
// ขอบเขต: ตอบเฉพาะสิ่งที่ path การ login ต้องใช้ · ทุก path ส่งข้อความถูกปฏิเสธเสียงดัง (403 + log)
//   GET  /profile/:userId  → 200 โปรไฟล์ปลอมที่ผูกกับ userId แบบคงที่ (ค่าเดิมทุกครั้ง)
//   POST /message/*        → 403 + log ตัวแดง ⇒ เห็นทันทีว่ามีโค้ดพยายามส่งข้อความ
//   อื่น ๆ                  → 404 + log ⇒ ถ้า BE เรียก endpoint ที่ stub ยังไม่รองรับ จะไม่เงียบ
import { createServer } from 'node:http'

const PORT = Number(process.env.LINE_STUB_PORT ?? 3200)

const log = (m) => console.log(`[line-stub] ${m}`)

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname
  const json = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  // 🛑 ทางส่งข้อความ — ปฏิเสธเสมอ ไม่มีโหมดให้เปิด (นี่คือเหตุผลที่ stub นี้มีอยู่)
  if (p.startsWith('/message') || p.includes('/message/')) {
    log(`🛑 ปฏิเสธการส่งข้อความ: ${req.method} ${p} — สนามซ้อมส่ง LINE ออกไม่ได้โดยการออกแบบ`)
    return json(403, { message: 'line-stub: outbound messaging is disabled in the practice arena' })
  }

  // โปรไฟล์ — สิ่งเดียวที่ registerOrLogin ต้องใช้
  const m = p.match(/^\/profile\/(.+)$/)
  if (req.method === 'GET' && m) {
    const userId = decodeURIComponent(m[1])
    log(`✅ profile ${userId.slice(0, 8)}…`)
    // ค่าคงที่ต่อ userId (ไม่สุ่ม) — สมัครซ้ำด้วยบัญชีเดิมต้องได้โปรไฟล์เดิม ไม่งั้นไล่บั๊กไม่ได้
    return json(200, {
      userId,
      displayName: `ผู้ใช้สนามซ้อม ${userId.slice(1, 7)}`,
      pictureUrl: 'http://localhost:3000/images/v2/mascot/01.webp',
      statusMessage: 'บัญชีทดสอบจาก line-stub (ไม่ใช่โปรไฟล์จริงจาก LINE)',
    })
  }

  log(`⚠️ ยังไม่รองรับ: ${req.method} ${p} — ถ้า BE ต้องใช้จริง ให้เพิ่มใน line-stub.mjs`)
  json(404, { message: `line-stub: unhandled ${req.method} ${p}` })
})

server.listen(PORT, () => {
  log(`ฟังอยู่ที่ http://localhost:${PORT}`)
  log('GET /profile/:id → 200 · POST /message/* → 403 (ปฏิเสธเสมอ) · อื่น ๆ → 404')
})
