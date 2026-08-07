# assets-src/ — raw image sources (NOT committed)

ที่วางภาพต้นฉบับ (raw, ความละเอียดสูง) ของทีม — **gitignored, ไม่ commit เลย**.
สิ่งที่ commit จริงคือ *ผลลัพธ์* ที่ `public/images/v2/…` (`.webp` ที่ย่อแล้ว).

## แปลง

```
npm run assets:optimize            # ทั้ง assets-src/
npm run assets:optimize <path>     # เฉพาะไฟล์/โฟลเดอร์ (relative to repo root หรือ absolute)
```

โครงสร้าง **สะท้อนอัตโนมัติ** — วางที่ไหนใน `assets-src/` ได้ `.webp` ที่ตำแหน่งเดียวกันใต้ `public/images/v2/`:

```
assets-src/mascot/x.png  →  public/images/v2/mascot/x.webp
assets-src/home/y.jpg    →  public/images/v2/home/y.webp
```

## กติกาของ script

- ย่อ **ฝั่งยาวสุด (longest side) ไม่เกิน 800px** (fit inside 800×800) · **ไม่ขยาย**ภาพที่เล็กกว่านั้น
  - 800px = พอสำหรับจุดที่มาสคอตใหญ่สุดในแอป (onboarding paint 375 CSS px → ต้องการ ~750px @DSF2 · วัดจริงโดยมุน, ไม่ใช่ 300 ที่เดาไว้ตอนแรก)
- แปลงเป็น `.webp` · คง alpha channel (มาสคอตลอยบนพื้น) · quality 82 · alphaQuality 100
- ไฟล์ที่ไม่ใช่ภาพ (`.png/.jpg/.jpeg`) → **ข้าม ไม่พัง**
- อ่านจาก **repo root เสมอ** (ไม่ใช่ cwd) — `assets-src/` gitignored จึงไม่ตามเข้า worktree; ทุก path resolve จากตำแหน่ง script

## ที่รู้ตัวและยอมรับ

- gitignored = **ไม่มี backup ใน git** → เครื่องพัง = ต้นฉบับหาย. ต้นฉบับความละเอียดสูงอยู่กับทีม/Figma ไม่ใช่ใน repo.
- CI มองไม่เห็น `assets-src/` → ไม่เป็นปัญหา: นี่คือ **เครื่องมือที่คนเรียก** ไม่ใช่ด่านที่ CI รันเอง.
