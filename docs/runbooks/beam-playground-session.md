# Runbook — Beam Playground session บน arena (local stack + cloudflared)

**ใช้เมื่อ:** จะพิสูจน์ slice 2–4 ของ Beam lane กับ Beam Playground จริง โดยไม่แตะ prod · ทุกอย่างวิ่งบน
`testenv/` (docker pg `:5433`, dump anonymised, guard กัน Supabase/Neon) + tunnel ให้ Beam ยิง webhook เข้าเครื่องได้

## ต้องมีก่อน (จากทีม / Lighthouse Playground)
- Playground **Merchant ID** + **API key** (Developers → API Key → Create → Show)
- สิทธิ์แก้ **Webhook** ใน Playground Lighthouse (Developer role พอ)
- **CARD เปิด**บนบัญชี ถ้าจะทดสอบ Payment Links (ถ้ายังไม่ผ่าน KYM ทดสอบได้แค่ PromptPay)

## ขั้นตอน
1. `bash testenv/scripts/stack.sh up` → boot 3 apps ตามที่พิมพ์ (fe `:3000` · be `:4000` · bazi `:3100`)
2. ใน `<repo>/.env` (ไฟล์ **local** ที่ stack.sh swap มา — **ห้าม**แก้ `testenv/env/*` ที่ commit) เพิ่ม:
   ```
   PAYMENT_GATEWAY=beam
   BEAM_API_BASE=https://playground.api.beamcheckout.com
   BEAM_MERCHANT_ID=…
   BEAM_API_KEY=…
   BEAM_WEBHOOK_HMAC_KEY=…        # ได้หลังข้อ 4
   OMISE_RETURN_ORIGIN_V2=…       # origin ที่ Beam จะ redirect กลับ (ต้อง https, ไม่ใช่ localhost) → ใช้ tunnel URL
   ```
   restart fe หลังแก้
3. `cloudflared tunnel --url http://localhost:3000` → จด `https://xxxx.trycloudflare.com` (เปลี่ยนทุกครั้งที่เปิดใหม่)
4. Playground Lighthouse → Developers → Webhook Settings → Create/Edit: URL = `https://xxxx.trycloudflare.com/api/v2/payment/webhook-beam`
   · events: `charge.succeeded` `charge.failed` `refund.succeeded` `refund.failed` `payment_link.paid` → คัดลอก **HMAC key** ใส่ `.env` ข้อ 2
5. **Headless ก่อน** (ไม่ต้องใช้ UI):
   ```
   npx tsx --env-file=.env scripts/beam-smoke.ts create            # PromptPay charge → QR PNG ใน /tmp
   # เปิด QR / หน้า Force Charge → "Mark as Succeeded" → webhook วิ่งเข้า tunnel
   npx tsx --env-file=.env scripts/beam-smoke.ts status <chargeId>   # port ตอบ paid/successful
   npx tsx --env-file=.env scripts/beam-smoke.ts refund <chargeId>   # refund.succeeded ตามมา
   ```
   ดู log fe: `[v2/payment/webhook-beam]` ต้องไม่มี `401 invalid signature` (ถ้ามี = HMAC key คนละ environment)
6. **ผ่าน UI** บน tunnel URL (login ด้วย dev Credentials หรือ LINE/Google ถ้า callback ครอบ):
   `/v2/shop` → เลือกแพ็ก → PromptPay: ต้องเห็น QR (data URI) และ result page เป็น APPROVED หลัง Mark as Succeeded
   → บัตร: ปุ่มชำระเงินพาไปหน้า Beam (Payment Link) → test card `4111 1111 1111 1111` / OTP card `4953 2617 3050 9988` (`123456`)
   → กลับที่ `/v2/shop/result?state=PAYING&order=…` → APPROVED · แถวใน DB: `charge_id` เปลี่ยนจาก `link:…` เป็น `ch_…`
7. ตรวจ DB (`psql postgres://postgres:postgres@localhost:5433/mumate_test`):
   `select status, gateway, charge_id, failure_code from v2_payment order by created_at desc limit 5;`
8. เสร็จแล้ว `bash testenv/scripts/stack.sh restore` คืน `.env` จริง · ปิด tunnel · **ลบ key Playground ออกจาก `.env` local**

## คำถามที่ต้องเก็บคำตอบจากรอบแรก (บันทึกใน CIEL closeout)
- Playground รับ `redirectUrl`/`returnUrl` ที่เป็น tunnel host ไหม (localhost ไม่ได้แน่ — ต้อง https)
- `qrPromptPay.expiresAt` ถูกรับหรือต้อง `expiryTime` · `encodedImage.expiry` ตรงกับที่ขอไหม
- `linkSettings` จำกัดหน้า link ให้เหลือแค่บัตรได้จริงไหม
- Beam ส่ง query param อะไรกลับที่ `redirectUrl` (เราไม่ใช้ แต่จดไว้)
- ลำดับ/ความถี่ของ `payment_link.paid` vs `charge.succeeded` สำหรับ link
