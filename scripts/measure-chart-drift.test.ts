// mumate-be-retirement-001 slice 1, DoD B2 — the pure half of scripts/measure-chart-drift.ts. The I/O half
// (a read-only session against a restored arena + the engine) is run by the coordinator, not by CI.
import { describe, expect, it } from 'vitest'
import {
  readLegacyChart,
  inNewYearWindow,
  inLateHour,
  classifyCause,
  emptyTally,
  tallyMember,
} from './measure-chart-drift'

// The shape BE stored (verified on testenv log_calculate rows): detail.yearBelow / detail.dayAbove / elementCycle.
const STORED = JSON.stringify({
  detail: {
    yearBelow: { id: 9, chinese_symbol: '申', constellation: 'MONKEY' },
    dayAbove: { id: 10, chinese_symbol: '癸', element: 'WATER', power: 'YIN' },
  },
  elementCycle: { id: 13, element: 'METAL', power: 'YANG', gender: 'MALE' },
})

describe('readLegacyChart', () => {
  it('reads the five values v2 used', () => {
    expect(readLegacyChart(STORED)).toEqual({ yearId: 9, element: 'WATER', power: 'YIN', cycleId: 13 })
  })
  it('elementCycle null (old charts) → cycleId null', () => {
    expect(readLegacyChart(JSON.stringify({ detail: { yearBelow: { id: 1 }, dayAbove: { element: 'WOOD', power: 'YANG' } }, elementCycle: null }))?.cycleId).toBeNull()
  })
  it('unparseable / no detail → null', () => {
    expect(readLegacyChart('{not json')).toBeNull()
    expect(readLegacyChart('{}')).toBeNull()
  })
})

describe('cause windows', () => {
  it('Jan 20 – Feb 20 inclusive', () => {
    expect(inNewYearWindow('1990-01-19')).toBe(false)
    expect(inNewYearWindow('1990-01-20')).toBe(true)
    expect(inNewYearWindow('1990-02-04')).toBe(true)
    expect(inNewYearWindow('1990-02-20')).toBe(true)
    expect(inNewYearWindow('1990-02-21')).toBe(false)
  })
  it('23:00 – 23:59 only', () => {
    expect(inLateHour('23:00')).toBe(true)
    expect(inLateHour('23:59')).toBe(true)
    expect(inLateHour('22:59')).toBe(false)
    expect(inLateHour('00:10')).toBe(false)
    expect(inLateHour('')).toBe(false)
  })
  it('a chart computed from another birth is "birthChanged" before any window', () => {
    expect(classifyCause({ dob: '1990-02-01', time: '23:10', gender: 'MALE' }, { dob: '1990-02-02', time: '23:10', gender: 'MALE' })).toBe('birthChanged')
    expect(classifyCause({ dob: '1990-02-01', time: '', gender: 'MALE' }, { dob: '1990-02-01', time: '', gender: 'FEMALE' })).toBe('birthChanged')
    expect(classifyCause({ dob: '1990-02-01', time: '23:10', gender: 'MALE' }, { dob: '1990-02-01', time: '23:10', gender: 'male' })).toBe('newYearWindow')
    expect(classifyCause({ dob: '1990-06-01', time: '23:10', gender: 'MALE' }, { dob: '1990-06-01', time: '23:10', gender: 'MALE' })).toBe('lateHour')
    expect(classifyCause({ dob: '1990-06-01', time: '', gender: 'MALE' }, { dob: '1990-06-01', time: '', gender: 'MALE' })).toBe('other')
  })
})

describe('tallyMember', () => {
  const legacy = { yearId: 9, element: 'WATER', power: 'YIN', cycleId: 13 }
  it('identical → same', () => {
    const t = emptyTally()
    tallyMember(t, legacy, { yearId: 9, element: 'WATER', power: 'YIN', cycleId: 13 }, 'other')
    expect(t).toMatchObject({ compared: 1, same: 1, anyDifference: 0, cycle: { same: 1 } })
  })
  it('animal differs → counted with its cause', () => {
    const t = emptyTally()
    tallyMember(t, legacy, { yearId: 8, element: 'WATER', power: 'YIN', cycleId: 13 }, 'newYearWindow')
    expect(t).toMatchObject({ animalDiffers: 1, anyDifference: 1, same: 0 })
    expect(t.anyDifferenceByCause.newYearWindow).toBe(1)
    expect(t.animalDiffersByCause.newYearWindow).toBe(1)
  })
  it('a cycle that appears where the legacy chart had none is NOT a difference', () => {
    const t = emptyTally()
    tallyMember(t, { ...legacy, cycleId: null }, { yearId: 9, element: 'WATER', power: 'YIN', cycleId: 20 }, 'other')
    expect(t).toMatchObject({ same: 1, anyDifference: 0, cycle: { newlyAvailable: 1 } })
  })
  it('element/power or cycle id differs → difference', () => {
    const t = emptyTally()
    tallyMember(t, legacy, { yearId: 9, element: 'WOOD', power: 'YANG', cycleId: 1 }, 'lateHour')
    expect(t).toMatchObject({ elementOrPowerDiffers: 1, anyDifference: 1, cycle: { differs: 1 } })
    tallyMember(t, legacy, { yearId: 9, element: 'WATER', power: 'YIN', cycleId: null }, 'birthChanged')
    expect(t.cycle.lost).toBe(1)
    expect(t.anyDifferenceByCause).toEqual({ birthChanged: 1, newYearWindow: 0, lateHour: 1, other: 0 })
  })
  it('the tally carries counts only — no field can hold an identifier', () => {
    const t = emptyTally()
    const walk = (v: unknown): void => {
      if (v && typeof v === 'object') Object.values(v).forEach(walk)
      else expect(typeof v).toBe('number')
    }
    walk(t)
  })
})
