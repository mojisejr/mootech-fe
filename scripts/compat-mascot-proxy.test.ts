// scripts/compat-mascot-proxy.test.ts — 3B: the mascot proxy maps a bazi response reading
// `imageUrlV2` ONLY, and NEVER falls back to the legacy `imageUrl`. DB-free, pure-function.
// marker: #compat-3b-mascot-v2-proxy   Run: npx tsx scripts/compat-mascot-proxy.test.ts
import assert from 'node:assert/strict'

import { mascotFromBaziResponse } from '../pages/api/bazi/mascot/[ganzhi]'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

const PROD_V2 =
  'https://soxsccdlsycaevusndro.supabase.co/storage/v1/object/public/mootech-v2/mascot/01_wood.png'
const OLD = 'https://wvcsrsjnkxikngnlwfwn.supabase.co/storage/v1/object/public/mascot-60/mascots/mascot_wood_above_1_below_1.png'

// ── the show case ──
t('imageUrlV2 present → mascot renders it', () => {
  const { mascot } = mascotFromBaziResponse(
    { ganzhi: '甲子', nameTh: 'ลีฟฟี่', nameEn: 'Leafy', imageUrlV2: PROD_V2 },
    '甲子',
  )
  assert.equal(mascot?.imageUrl, PROD_V2)
  assert.equal(mascot?.ganzhi, '甲子')
  assert.equal(mascot?.nameTh, 'ลีฟฟี่')
})

// ── the invariant: NEVER fall back to legacy imageUrl ──
t('imageUrlV2 AND legacy imageUrl both present → uses V2, never legacy', () => {
  const { mascot } = mascotFromBaziResponse({ ganzhi: '甲子', imageUrl: OLD, imageUrlV2: PROD_V2 }, '甲子')
  assert.equal(mascot?.imageUrl, PROD_V2)
  assert.notEqual(mascot?.imageUrl, OLD)
})

t('ONLY legacy imageUrl, no imageUrlV2 → mascot null (old set alone must HIDE)', () => {
  const { mascot } = mascotFromBaziResponse({ ganzhi: '甲子', imageUrl: OLD }, '甲子')
  assert.equal(mascot, null)
})

// ── absence → hide (rule 4) ──
t('neither field → null', () => assert.equal(mascotFromBaziResponse({ ganzhi: '甲子' }, '甲子').mascot, null))
t('imageUrlV2 empty string → null', () => assert.equal(mascotFromBaziResponse({ imageUrlV2: '' }, '甲子').mascot, null))
t('imageUrlV2 whitespace → null', () => assert.equal(mascotFromBaziResponse({ imageUrlV2: '   ' }, '甲子').mascot, null))
t('imageUrlV2 null → null', () => assert.equal(mascotFromBaziResponse({ imageUrlV2: null }, '甲子').mascot, null))
t('null/undefined data → null', () => {
  assert.equal(mascotFromBaziResponse(null, '甲子').mascot, null)
  assert.equal(mascotFromBaziResponse(undefined, '甲子').mascot, null)
})

// ── ganzhi fallback ──
t('data ไม่มี ganzhi → ใช้ fallback', () => {
  const { mascot } = mascotFromBaziResponse({ imageUrlV2: PROD_V2 }, '乙丑')
  assert.equal(mascot?.ganzhi, '乙丑')
})

console.log(`\n✓ compat-mascot-proxy: ${pass} passed`)
