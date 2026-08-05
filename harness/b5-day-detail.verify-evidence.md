# verify-evidence — B-5 day-detail BFF (ก้อนใหญ่สุด)

goo · 2026-08-05 · Track B · `pages/api/v2/day-detail.ts` (ใหม่) + `lib/v2-calendar/day-detail.ts` (mapper).

ยิง **2 upstream ขนาน** (man-vs-day ฝัง almanac แค่ 9 คีย์ → ต้องยิง almanac ด้วยสำหรับ deity·spirits(8เทพ)·
thaiLunar(วันพระ)·dayPillar/monthPillar/yearPillar). ตัด ~2.3MB → เฉพาะที่จอใช้. cache ต่อ (user,ลายเซ็นวันเกิด,วันที่).
gate OPEN (ฟีม Track B). ตาม field-map บองเป๊ะ — **ทุก field ชี้กลับ raw, ไม่มีท่อแต่งเอง**.

## proof-of-teeth
Bug-class: ท่อ **แต่ง field เอง** / ตัดผิดจนได้ null ที่ไม่ได้ตั้งใจ / ส่งก้อนใหญ่. `scripts/day-detail.test.ts` (19 assert, fixtures ตัดจาก man-vs-day+almanac จริง):

```
✅ day-detail.test.ts — 19 assertions passed (detail 2.3KB)
```
ทุก field trace กลับ raw: summary←summaryHeadline · grade←mvd.grade(pass-through, null เมื่อไม่มี) · suitable/avoid←summaryItems best/worst(by key) · insight←elementRelation.summaryTh · compatAreas←facets(isStrength=isMain, grade pass-through) · advice←main facet lines[3] · yams←luckyHours(code→id·range→window·god+meaning→label) · dayDeity←deity · spirits←8เทพ · wanPhra←thaiLunar.isWanPhra+label · dayPillars←almanac(ธาตุ) · ownerPillars←person.fourPillars · dithi←officer+desc+jianchu · **gates←8 raw ไม่มี level** (ตำราไม่มี) · **colors←ชื่อไทยดิบ ไม่มี hex** (งานดีไซน์).

**handler probe รันจริง (stub upstream — deployed ยังไม่มี grade):**
```
SIZE  raw upstream 2375KB → detail 7.0KB (< 50KB ✓)   ← ค่าจริงจาก man-vs-day+almanac ที่ curl มา
1st call 121ms (gate open, ได้ detail) · man-vs-day fetches=1
2nd call 0ms (cached=true) · man-vs-day fetches still=1   ← cache: 2nd เร็วขึ้นชัด + ไม่ยิง upstream ซ้ำ
```

ANCHOR: scripts/day-detail.test.ts#b5-day-detail-traces

## adversary sign-off
Cross-oracle (ตู๋ static + curl): (ก) มี field ไหนท่อแต่งเองไหม — 16 field trace-to-raw ทดสอบครบ (ถ้า mapper แต่งค่า → แดง) (ข) gates เดาระดับดี/ร้ายไหม — ไม่ (raw, assert `!('level' in gates[0])`) (ค) colors แปลง hex ไหม — ไม่ (assert `!/^#/`) (ง) null ที่ไม่ตั้งใจ — grade/percent guard, field ว่างเป็น '' ไม่ใช่ null (จ) 2 upstream ยิงจริงไหม — probe: man-vs-day + almanac ทั้งคู่. **⚠️ curl ผ่าน server จริง end-to-end รอ #18 deploy (grade) + dual-server** → พิสูจน์ด้วย real captured shapes (2375KB→7KB) + handler probe (cache/gate) + man-vs-day/almanac real-curl.

## evidence limits
size 7.0KB วัดจาก man-vs-day+almanac **ที่ curl จริง** (person 1990-05-15/2026-08-05). handler probe = real handler + stubbed upstream. ไม่แตะ `features/` · `pages/*.tsx` (git diff).
