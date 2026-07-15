// Deterministic tests for the locked 5-element palette (#public-bazi-calculator). Pins the
// contrast/distinguishability guarantees the design review actually verified — regressing any
// of these values should fail loudly, not silently ship a color that fails WCAG or collides
// with another element.
// Run: bun scripts/calc-elements.test.ts   or: npx tsx scripts/calc-elements.test.ts
import assert from 'node:assert/strict'
import { ELEMENT_COLOR, elementColor, elementLabel, type BaziElement } from '../lib/calculator/elements'

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

function relativeLuminance(hex: string): number {
  const [r, g, b] = (hex.replace('#', '').match(/.{2}/g) ?? []).map((x) => {
    const v = parseInt(x, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const WHITE = '#FFFFFF'
const BG_GRAY = '#E9EAEB'

function main() {
  t('every element color hits >=4.5:1 on both white and bg_gray (มุน guardrail #2)', () => {
    for (const [name, hex] of Object.entries(ELEMENT_COLOR)) {
      const onWhite = contrastRatio(hex, WHITE)
      const onGray = contrastRatio(hex, BG_GRAY)
      assert.ok(onWhite >= 4.5, `${name} ${hex} on white: ${onWhite.toFixed(2)} < 4.5`)
      assert.ok(onGray >= 4.5, `${name} ${hex} on bg_gray: ${onGray.toFixed(2)} < 4.5`)
    }
  })

  t('EARTH and METAL are distinguishable (the ΔE collision มุน caught and fixed)', () => {
    // v2 (#calculator-reframe-v2): METAL returned to GOLD (ฟีม direction) as a glyph tone #8A5E12,
    // with EARTH shifted to a cooler OLIVE #5F5326 so the pair stays distinguishable — re-verified
    // externally at CIE76 ΔE 24.0 (>=15). Pin the exact hexes so a naive revert to the old ochre
    // #8B5F20 / a brighter gold (which would collide again) is caught.
    assert.notEqual(ELEMENT_COLOR.EARTH, ELEMENT_COLOR.METAL)
    assert.equal(ELEMENT_COLOR.METAL, '#8A5E12')
    assert.equal(ELEMENT_COLOR.EARTH, '#5F5326')
  })

  t('elementColor falls back to a neutral gray for unknown/missing element, never throws', () => {
    assert.equal(elementColor(undefined), '#6B7280')
    assert.equal(elementColor(null), '#6B7280')
    assert.equal(elementColor('NOT_AN_ELEMENT'), '#6B7280')
  })

  t('elementColor resolves all 5 known elements to their locked hex', () => {
    const all: BaziElement[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']
    for (const el of all) assert.equal(elementColor(el), ELEMENT_COLOR[el])
  })

  t('elementLabel returns empty string for unknown/missing element (no "ธาตุundefined" leak)', () => {
    assert.equal(elementLabel(undefined), '')
    assert.equal(elementLabel('BOGUS'), '')
    assert.equal(elementLabel('WOOD'), 'ธาตุไม้ · Wood')
  })

  if (process.exitCode) {
    console.error(`\ncalc-elements: FAILED (${pass} passed)`)
  } else {
    console.log(`calc-elements: all ${pass} passed ✓`)
  }
}

main()
