// B-5 — day-detail mapper. Plain tsx + node:assert. Fixtures are trimmed from REAL man-vs-day(day) +
// almanac day-objects (bazi-sft-dataset.vercel.app, person 1990-05-15/2026-08-05). Every mapped field must
// trace to a raw upstream field — the pipe invents nothing. #b5-day-detail-traces
import assert from 'node:assert'
import { mapDayDetail } from '../lib/v2-calendar/day-detail'

let pass = 0
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

const MVD = {
  date: '2026-08-05',
  dayGanzhi: '辛亥',
  overallPercent: 40.83,
  grade: 'C-',
  verdict: 'caution',
  summaryHeadline: 'วันแห่งการทบทวน',
  summary: 'fallback summary',
  summaryItems: [
    { key: 'best', text: 'อยู่กับเพื่อน / พี่น้อง' },
    { key: 'worst', text: 'ไปงานสังคม / สื่อ' },
    { key: 'strength', text: 'x' },
    { key: 'element', text: 'y' },
    { key: 'officer', text: 'z' },
  ],
  elementRelation: { summaryTh: 'ธาตุของวันเสริมดิถีคุณ' },
  facets: [
    { key: 'day', label: 'คู่ครอง', percent: 20.5, grade: 'F', isMain: true, lines: [{ text: 'บรรทัด 1' }, { text: 'บรรทัด 2' }, { text: 'บรรทัด 3' }] },
    { key: 'wealth', label: 'ทรัพย์', percent: 55, grade: 'C+', isMain: false, lines: [] },
    { key: 'work', label: 'การงาน', percent: 60, grade: 'B-', isMain: false, lines: [] },
    { key: 'health', label: 'สุขภาพ', percent: 48, grade: 'C', isMain: false, lines: [] },
  ],
  almanac: { luckyHours: [{ code: 'B8', range: '1:00-2:59', god: 'เหง็กอ๋วง', meaning: 'ดี' }] },
  // real lucky_dir shape: 'ทิศ ' + short code (the almanac data holds ทิศ N · ทิศ S · ทิศ E · ทิศ W · ทิศ SE).
  // Was 'ทิศตะวันออก', a form nothing actually emits — มุน 2026-08-06 on ตู๋'s catch.
  luckyDirection: 'ทิศ E',
  person: { fourPillars: { year: { stem: '庚' }, month: {}, day: {}, hour: {} } },
}
const ALMANAC_DAY = {
  date: '2026-08-05',
  deity: 'เจ้าพ่อเสือ',
  spirits: Array.from({ length: 8 }, (_, i) => ({ name: `S${i}`, keywords: ['ก', 'ข'] })),
  thaiLunar: { isWanPhra: false, label: 'แรม ๗ ค่ำ เดือน ๘-๘' },
  dayPillar: { stem: '辛', branch: '亥', ganzhi: '辛亥', element: 'metal' },
  monthPillar: { stem: '乙', branch: '未', ganzhi: '乙未', element: 'wood' },
  yearPillar: { stem: '丙', branch: '午', ganzhi: '丙午', element: 'fire' },
  officer: 'สะสาง',
  officerDesc: 'อับโชค เสียหาย',
  jianchu: { name: 'เตีย', meaning: 'มัดจำ จองจำ' },
  gates: Array.from({ length: 8 }, (_, i) => ({ name: `G${i}`, direction: 'E', meaning: 'เปิด' })),
  colors: [{ element: 'ทอง', colors: 'ขาว' }, { element: 'น้ำ', colors: 'ฟ้า น้ำเงิน' }],
  luckyHours: [{ code: 'B8', range: '1:00-2:59', god: 'เหง็กอ๋วง', meaning: 'ดี' }],
}

const d = mapDayDetail(MVD, ALMANAC_DAY)

ok('summary ← summaryHeadline', d.summary === 'วันแห่งการทบทวน')
ok('grade ← mvd.grade (pass-through, not re-derived)', d.grade === 'C-')
ok('grade null when absent', mapDayDetail({ ...MVD, grade: undefined }, ALMANAC_DAY).grade === null)
// suitable/avoid = string[] (μุน #178 review): the UI does .slice().map() — a bare string crashes it.
// Adapter splits the "/"-delimited best/worst text into a LIST; it must be an ARRAY, never a string.
ok('suitable ← summaryItems key=best, SPLIT into a list', Array.isArray(d.suitable) && JSON.stringify(d.suitable) === JSON.stringify(['อยู่กับเพื่อน', 'พี่น้อง']))
ok('avoid ← summaryItems key=worst, SPLIT into a list', Array.isArray(d.avoid) && JSON.stringify(d.avoid) === JSON.stringify(['ไปงานสังคม', 'สื่อ']))
ok('suitable/avoid survive UI .slice().map() — no TypeError', (() => { try { d.suitable.slice(0, 2).map((s) => s.trim()); d.avoid.slice(0, 2).map((s) => s.trim()); return true } catch { return false } })())
ok('absent best/worst → [] (not a bare string, Column empty-guards it)', (() => { const e = mapDayDetail({ ...MVD, summaryItems: [] }, ALMANAC_DAY); return Array.isArray(e.suitable) && e.suitable.length === 0 })())
ok('insight ← elementRelation.summaryTh', d.insight === 'ธาตุของวันเสริมดิถีคุณ')
ok('compatAreas ← facets (4), isStrength=isMain', d.compatAreas.length === 4 && d.compatAreas[0].isStrength === true && d.compatAreas[1].isStrength === false)
ok('compatAreas carry facet grade pass-through', d.compatAreas[1].grade === 'C+')
ok('advice ← MAIN facet lines[].text (3 บรรทัด)', d.advice.length === 3 && d.advice[0] === 'บรรทัด 1')
ok('yams ← luckyHours (code→id · range→window · god+meaning→label)', d.yams.length === 1 && d.yams[0].id === 'B8' && d.yams[0].window === '1:00-2:59' && d.yams[0].label === 'เหง็กอ๋วง · ดี')
ok('dayDeity ← almanac.deity', d.dayDeity === 'เจ้าพ่อเสือ')
ok('spirits ← 8 เทพ + keywords', d.spirits.length === 8 && d.spirits[0].keywords.length === 2)
ok('wanPhra ← thaiLunar.isWanPhra + label', d.wanPhra.isWanPhra === false && d.wanPhra.label === 'แรม ๗ ค่ำ เดือน ๘-๘')
ok('dayPillars ← almanac day/month/year (with element)', d.dayPillars.day?.element === 'metal' && d.dayPillars.month?.element === 'wood' && d.dayPillars.year?.element === 'fire')
ok('ownerPillars ← person.fourPillars (raw block)', JSON.stringify(d.ownerPillars) === JSON.stringify(MVD.person.fourPillars))
ok('dithi ← officer + officerDesc + jianchu', d.dithi.officer === 'สะสาง' && d.dithi.jianchu === 'เตีย · มัดจำ จองจำ')
// G-3 chips: officer (dithi) + luckyDirection, RAW; the 財 chip is cut (bazi's 8 gates have no 財).
ok('luckyDirection ← man-vs-day (raw ทิศมงคล, a chip; 財 cut)', d.luckyDirection === 'ทิศ E')
ok('gates ← 8 raw, NO good/bad level added (ตำราไม่มี)', d.gates.length === 8 && !('level' in d.gates[0]) && d.gates[0].name === 'G0')
ok('colors ← raw Thai names, NO hex (งานดีไซน์)', d.colors[0].colors === 'ขาว' && !/^#/.test(d.colors[0].colors))

// trim size — the whole point of the pipe
const size = Buffer.byteLength(JSON.stringify(d))
ok('trimmed detail < 50KB', size < 50 * 1024)

console.log(`✅ day-detail.test.ts — ${pass} assertions passed (detail ${(size / 1024).toFixed(1)}KB)`)
