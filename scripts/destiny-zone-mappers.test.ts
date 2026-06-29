// Deterministic tests for the Zone1+2 bazi reading mappers (#my-destiny-bazi-engine-swap).
// Network-free: loads real consumer-mode fixtures captured in P0. Run: npx tsx scripts/destiny-zone-mappers.test.ts
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { mapChartFoundation } from "../lib/destiny/map-chart-foundation"
import { mapLove, mapWork } from "../lib/destiny/map-love-work"
import { mapBeCareful } from "../lib/destiny/map-be-careful"
import { stripBaziMarkup } from "../lib/destiny/strip-bazi-markup"

const DIR = join(__dirname, "fixtures", "destiny")
const load = (chart: string, topic: string) =>
  JSON.parse(readFileSync(join(DIR, `${chart}__${topic}.json`), "utf8"))

const CHARTS = ["condark_m", "case_f", "case_m"]

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

const clean = (s: string) => !s.includes("[[") && !s.includes("]]") && !/(^|\n)##\s/.test(s)

// ── strip util ──
t("stripBaziMarkup removes color spans, keeps Chinese chars", () => {
  const out = stripBaziMarkup("[[c=fire]]ดิถี 己 ดินหยิน[[/c]]")
  assert.equal(out, "ดิถี 己 ดินหยิน")
})

// ── Zone 1: chart_foundation -> 3 cards (deterministic prose index) ──
for (const chart of CHARTS) {
  t(`chart_foundation maps 3 cards (${chart})`, () => {
    const fx = load(chart, "chart_foundation")
    const o = mapChartFoundation(fx)
    assert.ok(o, "overlay should not be null")
    // index alignment to source prose
    assert.equal(o!.baseDescription, (fx.reading.prose[0] as string).trim())
    assert.equal(o!.habitNote, (fx.reading.prose[1] as string).trim())
    assert.equal(o!.behaviorText, (fx.reading.prose[2] as string).trim())
    // no markup leaked
    assert.ok(clean(o!.baseDescription) && clean(o!.habitNote) && clean(o!.behaviorText))
    // all non-empty
    assert.ok(o!.baseDescription.length > 0 && o!.habitNote.length > 0 && o!.behaviorText.length > 0)
  })
}

t("chart_foundation card2 (prose[1]) is the strength reading (starts ดิถี)", () => {
  const o = mapChartFoundation(load("condark_m", "chart_foundation"))
  assert.ok(o!.habitNote.startsWith("ดิถี"), o!.habitNote.slice(0, 20))
})

t("mapChartFoundation returns null when prose triplet missing", () => {
  assert.equal(mapChartFoundation({ reading: { prose: ["only-one"] } }), null)
  assert.equal(mapChartFoundation(null), null)
  assert.equal(mapChartFoundation({}), null)
})

// ── Zone 2: love (T1 paragraphs + T3 noise removal) ──
for (const chart of CHARTS) {
  t(`love maps to a clean multi-paragraph note (${chart})`, () => {
    const o = mapLove(load(chart, "love_partner"))
    assert.ok(o && o.note.length > 0)
    assert.ok(clean(o!.note), "no markup/headers in love note")
    // intro explainer dropped: love body should mention คู่ครอง, not the generic meta line
    assert.ok(o!.note.includes("คู่ครอง") || o!.note.includes("คู่"))
    // T1: paragraph breaks preserved so the card can breathe (>=2 blocks)
    const paras = o!.note.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    assert.ok(paras.length >= 2, `love should be multi-paragraph, got ${paras.length}`)
    // T3: title-echo framing line removed
    assert.ok(!o!.note.includes("พิจารณารายละเอียดต่อไปนี้"), "title-echo leaked")
    // T3: no orphan connector-only paragraph
    assert.ok(!paras.some((p) => p.trim() === "ขณะเดียวกัน"), "orphan connector leaked")
  })
}

t("mapLove returns null on empty", () => {
  assert.equal(mapLove({ humanReading: "" }), null)
  assert.equal(mapLove(null), null)
})

// ── Zone 2: work (W-A: disposition only, no occupation lists) ──
for (const chart of CHARTS) {
  t(`work maps to disposition bullets, no occupation lists (${chart})`, () => {
    const o = mapWork(load(chart, "career_potential"))
    assert.ok(o && o.desc.length > 0)
    const joined = o!.desc.map((d) => d.note).join("\n")
    assert.ok(clean(joined), "no markup/headers in work desc")
    // W-A boundary: occupation-list markers must NOT appear
    assert.ok(!/อาชีพธาตุ.{0,8}อันดับ/.test(joined), "occupation-list header leaked")
    assert.ok(!joined.split("\n").some((l) => l.startsWith("•")), "bullet occupation leaked")
    assert.ok(!joined.includes("ดังนี้:"), "list lead-in leaked")
    // T3: title-echo framing line removed from work bullets too
    assert.ok(!joined.includes("พิจารณารายละเอียดต่อไปนี้"), "title-echo leaked into work")
  })
}

t("mapWork returns null on empty", () => {
  assert.equal(mapWork({ humanReading: "" }), null)
  assert.equal(mapWork(null), null)
})

// ── Zone 3: be_careful (turning_points clash-timing lines only) ──
for (const chart of CHARTS) {
  t(`be_careful maps clash-timing lines, breathing paragraphs (${chart})`, () => {
    const o = mapBeCareful(load(chart, "turning_points"))
    assert.ok(o && o.description.length > 0)
    assert.ok(clean(o!.description), "no markup/headers in be_careful")
    const paras = o!.description.split(/\n{2,}/).filter((p) => p.trim().length > 0)
    // multiple clash lines kept as breathing paragraphs
    assert.ok(paras.length >= 2, `expected multiple clash lines, got ${paras.length}`)
    // every paragraph IS a clash-timing line (no life-cycle narrative leaked)
    assert.ok(paras.every((p) => /เป็นจังหวะ/.test(p)), "non-clash line leaked")
    // includes at least one yearly clash + the recurring monthly clash
    assert.ok(paras.some((p) => /ปี พ\.ศ\./.test(p)), "missing yearly clash")
    assert.ok(paras.some((p) => /เดือนนักษัตร/.test(p)), "missing monthly clash")
  })
}

t("mapBeCareful returns null on empty / no-clash", () => {
  assert.equal(mapBeCareful({ humanReading: "" }), null)
  assert.equal(mapBeCareful(null), null)
  assert.equal(mapBeCareful({ humanReading: "บทนำเฉย ๆ ไม่มีจังหวะปะทะ" }), null)
})

console.log(`\ndestiny-zone-mappers: ${pass} passed`)
