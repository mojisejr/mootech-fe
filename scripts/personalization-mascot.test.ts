// Deterministic tests for the personalization mascot resolver (DESIGN.md §7, decision C).
// Run: bun scripts/personalization-mascot.test.ts   or: npx tsx scripts/personalization-mascot.test.ts
import assert from 'node:assert/strict'
import {
  ZODIAC_TABLE,
  toNakkasat,
  zodiacOrder,
  normalizeElement,
} from '../lib/personalization/zodiac'
import {
  buildMascotPaths,
  resolveMascot,
  resolveMascotFromCompute,
  animalFromCompute,
  elementFromCompute,
} from '../lib/personalization/mascot'

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

function main() {
  t('table has 12 นักษัตร in canonical order 01..12', () => {
    assert.equal(ZODIAC_TABLE.length, 12)
    assert.deepEqual(
      ZODIAC_TABLE.map((z) => z.order),
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
    )
    assert.equal(ZODIAC_TABLE[0].th, 'ชวด')
    assert.equal(ZODIAC_TABLE[11].th, 'กุน')
  })

  t('toNakkasat: Thai นักษัตร passes through', () => {
    assert.equal(toNakkasat('ชวด'), 'ชวด')
    assert.equal(toNakkasat('  กุน  '), 'กุน')
  })

  t('toNakkasat: English constellation (backend) -> Thai', () => {
    assert.equal(toNakkasat('PIG'), 'กุน') // verified in constants/api/response-chinese-horoscope.ts
    assert.equal(toNakkasat('rat'), 'ชวด')
    assert.equal(toNakkasat('Rooster'), 'ระกา')
  })

  t('toNakkasat: English aliases still resolve', () => {
    assert.equal(toNakkasat('MOUSE'), 'ชวด')
    assert.equal(toNakkasat('SHEEP'), 'มะแม')
    assert.equal(toNakkasat('CHICKEN'), 'ระกา')
    assert.equal(toNakkasat('CAT'), 'เถาะ')
  })

  t('toNakkasat: Chinese branch glyph -> Thai', () => {
    assert.equal(toNakkasat('子'), 'ชวด')
    assert.equal(toNakkasat('亥'), 'กุน')
    assert.equal(toNakkasat('午'), 'มะเมีย')
  })

  t('toNakkasat: branch id 1..12 (number or numeric string) -> Thai', () => {
    assert.equal(toNakkasat(1), 'ชวด')
    assert.equal(toNakkasat(12), 'กุน')
    assert.equal(toNakkasat('12'), 'กุน')
  })

  t('toNakkasat: invalid -> null (guarded)', () => {
    assert.equal(toNakkasat(''), null)
    assert.equal(toNakkasat('   '), null)
    assert.equal(toNakkasat('DINOSAUR'), null)
    assert.equal(toNakkasat(0), null)
    assert.equal(toNakkasat(13), null)
    assert.equal(toNakkasat(null), null)
    assert.equal(toNakkasat(undefined), null)
  })

  t('zodiacOrder maps every นักษัตร to its NN', () => {
    assert.equal(zodiacOrder('ชวด'), '01')
    assert.equal(zodiacOrder('มะเส็ง'), '06')
    assert.equal(zodiacOrder('กุน'), '12')
    assert.equal(zodiacOrder('nope'), null)
  })

  t('normalizeElement: English BaziElement (any case)', () => {
    assert.deepEqual(normalizeElement('WOOD'), { en: 'WOOD', th: 'ไม้', labelTh: 'ธาตุไม้', labelEn: 'Wood' })
    assert.equal(normalizeElement('metal')?.th, 'ทอง')
  })

  t('normalizeElement: plain Thai ธาตุ', () => {
    assert.equal(normalizeElement('ไฟ')?.en, 'FIRE')
    assert.equal(normalizeElement('น้ำ')?.en, 'WATER')
  })

  t('normalizeElement: STRIPS polarity (ไม้หยิน -> ไม้), with/without space', () => {
    assert.equal(normalizeElement('ไม้หยิน')?.th, 'ไม้')
    assert.equal(normalizeElement('ไม้หยาง')?.th, 'ไม้')
    assert.equal(normalizeElement('ทอง หยิน')?.th, 'ทอง')
    assert.equal(normalizeElement('ไม้หยิน')?.en, 'WOOD')
  })

  t('normalizeElement: invalid -> null (guarded)', () => {
    assert.equal(normalizeElement(''), null)
    assert.equal(normalizeElement('plasma'), null)
    assert.equal(normalizeElement(null), null)
    assert.equal(normalizeElement(undefined), null)
  })

  t('buildMascotPaths: canonical filename + absolute public paths', () => {
    const m = buildMascotPaths('กุน', 'ไม้')
    assert.ok(m)
    assert.equal(m!.order, '12')
    assert.equal(m!.filename, '12_กุน-ไม้')
    assert.equal(m!.character, '/images/v2/characters/12_กุน-ไม้.webp')
    assert.equal(m!.card, '/images/v2/cards/12_กุน-ไม้.jpg')
    assert.equal(m!.elementEn, 'WOOD')
    assert.equal(m!.elementLabelTh, 'ธาตุไม้')
  })

  t('resolveMascot: hybrid axes (English animal + polarity element)', () => {
    const m = resolveMascot('PIG', 'ไม้หยิน')
    assert.equal(m!.character, '/images/v2/characters/12_กุน-ไม้.webp')
    assert.equal(m!.card, '/images/v2/cards/12_กุน-ไม้.jpg')
  })

  t('resolveMascot: guards a bad axis -> null', () => {
    assert.equal(resolveMascot('PIG', 'plasma'), null)
    assert.equal(resolveMascot('DINOSAUR', 'ไม้'), null)
    assert.equal(resolveMascot(null, null), null)
  })

  t('animalFromCompute: constellation > id > branch glyph precedence', () => {
    assert.equal(animalFromCompute({ detail: { yearBelow: { constellation: 'PIG', id: 1 } } }), 'กุน')
    assert.equal(animalFromCompute({ detail: { yearBelow: { id: 7 } } }), 'มะเมีย')
    assert.equal(animalFromCompute({ yearOfZodiac: { below: '亥' } }), 'กุน')
    assert.equal(animalFromCompute({}), null)
    assert.equal(animalFromCompute(null), null)
  })

  t('elementFromCompute: enrichment.dayMasterElement, then day pillar fallback', () => {
    assert.equal(elementFromCompute({ enrichment: { dayMasterElement: 'ไม้หยิน' } }), 'ไม้หยิน')
    assert.equal(
      elementFromCompute({ enrichment: { pillars: { day: { stemElement: 'ทอง' } } } }),
      'ทอง',
    )
    assert.equal(elementFromCompute({ enrichment: null }), null)
  })

  t('resolveMascotFromCompute: real-ish payload -> mascot', () => {
    // Mirrors the /api/calculator/compute `data` shape (亥 branch = PIG = กุน, day-master ธาตุไม้).
    const data = {
      yearOfZodiac: { below: '亥' },
      detail: { yearBelow: { constellation: 'PIG', id: 12 } },
      enrichment: { dayMasterElement: 'ไม้หยิน', pillars: { day: { stemElement: 'ไม้' } } },
    }
    const m = resolveMascotFromCompute(data)
    assert.ok(m)
    assert.equal(m!.character, '/images/v2/characters/12_กุน-ไม้.webp')
    assert.equal(m!.animalTh, 'กุน')
    assert.equal(m!.elementTh, 'ไม้')
  })

  t('resolveMascotFromCompute: missing enrichment -> null (caller shows fallback)', () => {
    assert.equal(
      resolveMascotFromCompute({ detail: { yearBelow: { constellation: 'PIG', id: 12 } }, enrichment: null }),
      null,
    )
  })

  t('every one of the 60 hybrid pairs builds a well-formed path', () => {
    const elements = ['ไม้', 'ไฟ', 'ดิน', 'ทอง', 'น้ำ']
    let n = 0
    for (const z of ZODIAC_TABLE) {
      for (const el of elements) {
        const m = buildMascotPaths(z.th, el)
        assert.ok(m, `${z.th}-${el} should resolve`)
        assert.equal(m!.character, `/images/v2/characters/${z.order}_${z.th}-${el}.webp`)
        assert.equal(m!.card, `/images/v2/cards/${z.order}_${z.th}-${el}.jpg`)
        n++
      }
    }
    assert.equal(n, 60)
  })

  console.log(`${pass} passed`)
}

main()
