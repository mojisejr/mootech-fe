// scripts/destiny-screen-mount.test.tsx — จอ "ดวงฉัน" (/v2/destiny) ประกอบจริงด้วย fixture
// (element-completeness ตาม docs/duang-chan-spec.md — Figma node 55349-3070).
//
// ทำไมต้อง mount: ตามบทเรียน account-screen-mount (ตู๋ R1/R2) — การ assert สำนวนในโค้ดเป็นฟันที่ไม่มีเขี้ยว
// จอนี้ต้องตอบคำถามของ M ให้ได้ว่า "icon ครบ ปุ่มครบ เชื่อมครบ ใช้ได้" — เลย mount ด้วยข้อมูลจริงรูปร่าง
// ที่โพรบมาจาก engine deploy จริง (pdf-dev) แล้วอ่านสิ่งที่คนเห็นจริงบนจอ
//
// 🔴 MUTANT CONTRACT (แต่ละข้อต้องทำให้ npm test แดง):
//   D1  ลบ ปุ่มแชร์ +10 QI หรือปุ่ม Mate AI        → "share pill + Mate AI dock" แดง
//   D2  ลบแถบคะแนนใด ๆ (career/learning/friends)   → "three domain bars" แดง
//   D3  ลบชิปเสาใด ๆ (ปี/เดือน/วัน/เวลา/ลัคนา)      → "five pillar chips" แดง
//   D4  ลบ Life Path svg                            → "life path chart" แดง
//   D5  ลบแถวจองไว้ล่วงหน้า (30 QI)                 → "preorder rows" แดง
//   D6  ลบการ์ดชวนเพื่อน                            → "referral card" แดง
//   D7  fetch /api/destiny 409                     → ต้องโชว์การ์ด "ข้อมูลวันเกิดยังไม่ครบ" (guard)
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"

vi.mock("next/config", () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

const FIXTURE = {
  elementSummary: {
    dayMaster: "甲",
    dayGanzhi: "甲子",
    elementTh: "ไม้",
    tagline: "คุณคือผู้สร้างและพัฒนาไม่หยุดนิ่ง",
    traits: ["มองไกล", "ริเริ่มเก่ง"],
    advice: ["เสริมด้วยสีเขียว"],
  },
  lifeTimeline: {
    currentAge: 31,
    favorableElementsTh: ["ไฟ"],
    current: { startAge: 30, endAge: 39, ganzhi: "庚辰", upperState: "ขึ้น" },
    years: [
      { age: 30, score: 40 },
      { age: 31, score: 55 },
      { age: 32, score: 70 },
    ],
    cautionYears: [{ year: 2027 }],
    note: "",
  },
  strengthScore: { dayMaster: "甲", strengthScore: 62 },
  domainPower: {
    domainPower: {
      career: { score: 95, band: "very-strong" },
      learning: { score: 75, band: "strong" },
      friends: { score: 55, band: "balanced" },
      wealth: { score: 40, band: "balanced" },
    },
  },
  calculatedState: {
    fourPillars: {
      year: { stem: "乙", branch: "亥" },
      month: { stem: "甲", branch: "申" },
      day: { stem: "甲", branch: "子" },
      hour: { stem: "庚", branch: "午" },
    },
    mingGong: { stem: "壬", branch: "寅" },
    elementAnalysis: {
      totalCounts: { wood: 3, fire: 1, earth: 2, metal: 1, water: 1 },
      dominantElements: ["wood"],
      missingElements: ["metal"],
    },
  },
}

async function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
}

const mountScreen = async () => {
  const { DestinyScreen } = await import("../features/v2-destiny/components/DestinyScreen")
  render(<DestinyScreen />)
  await waitFor(() => expect(screen.getByTestId("destiny-hero")).toBeTruthy())
}

describe("DestinyScreen (ดวงฉัน, node 55349-3070) — element completeness", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = typeof input === "string" ? input : input?.url ?? ""
        if (String(url).includes("/api/destiny")) return jsonOk(FIXTURE)
        if (String(url).includes("/api/bazi-mascot")) {
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          })
        }
        return new Response("{}", { status: 200 })
      }) as unknown as typeof fetch,
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("hero: มาสคอต + ชื่อธาตุ + แถบคะแนน 3 แถวพร้อมเกรด A/B/C+ (D2)", async () => {
    await mountScreen()
    expect(screen.getByAltText("มาสคอตประจำวันเกิด")).toBeTruthy()
    expect(screen.getByText("ดวงของคุณ ธาตุไม้")).toBeTruthy()
    expect(screen.getByText("การงาน")).toBeTruthy()
    expect(screen.getByText("การเรียนรู้")).toBeTruthy()
    expect(screen.getByText("สกิลสัมพันธ์")).toBeTruthy() // ป้าย design-exact (เดิม เพื่อน)
    expect(screen.getByText("A")).toBeTruthy()
    expect(screen.getByText("B")).toBeTruthy()
    expect(screen.getByText("C+")).toBeTruthy()
    expect(screen.getByTestId("destiny-share")).toBeTruthy()
    expect(screen.getByTestId("destiny-mate-ai")).toBeTruthy()
  })

  it("ชิปเสา 5 ตัว: ปี เดือน วัน เวลา ลัคนา + ปุ่มโชว์จุดอ่อน (D3)", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-pillars")).toBeTruthy()
    expect(screen.getByText("ปี")).toBeTruthy()
    expect(screen.getByText("เดือน")).toBeTruthy()
    expect(screen.getByText("วัน")).toBeTruthy()
    expect(screen.getByText("เวลา")).toBeTruthy()
    expect(screen.getByText("ลัคนา")).toBeTruthy()
    expect(screen.getByTestId("destiny-weakness-toggle")).toBeTruthy()
  })

  it("ธาตุของคุณ: ธาตุ + ลักษณะเด่น + คำแนะนำ + ธาตุที่ช่วยสมดุล", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-element")).toBeTruthy()
    expect(screen.getByText("ลักษณะเด่น")).toBeTruthy()
    expect(screen.getByText("มองไกล")).toBeTruthy()
    expect(screen.getByText(/ธาตุที่ช่วยสมดุล/)).toBeTruthy()
  })

  it("ธาตุสมดุล: นับครบ 5 ธาตุ + ธาตุเด่น + ธาตุที่ควรเสริม", async () => {
    await mountScreen()
    const balance = screen.getByTestId("destiny-balance").textContent ?? ""
    for (const el of ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]) {
      expect(balance).toContain(el)
    }
    expect(balance).toContain("ธาตุเด่น")
    expect(balance).toContain("ธาตุที่ควรเสริม")
    expect(balance).toContain("ไม้") // dominant wood ปรากฏในการ์ดเดียวกัน
  })

  it("Life Path: กราฟ + วัยจรปัจจุบัน + ปีที่ควรระวัง (D4)", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-lifepath")).toBeTruthy()
    expect(screen.getByTestId("destiny-life-chart")).toBeTruthy()
    expect(screen.getByText(/ตอนนี้อายุ 31/)).toBeTruthy()
    expect(screen.getByText(/ปีที่ควรระวัง/)).toBeTruthy()
  })

  it("จองไว้ล่วงหน้า 2 แถว แบบ 30 QI (D5) + การ์ดชวนเพื่อน (D6)", async () => {
    await mountScreen()
    expect(screen.getAllByTestId("destiny-preorder-row").length).toBe(2)
    expect(screen.getAllByText("30 QI").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId("destiny-referral")).toBeTruthy()
    expect(screen.getByText(/ชวนเพื่อนมารับ รับคนละ 50 QI/)).toBeTruthy()
  })

  it("guard: 409 profile_incomplete → การ์ด 'ข้อมูลวันเกิดยังไม่ครบ' (D7)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ code: "profile_incomplete" }), { status: 409 })) as unknown as typeof fetch,
    )
    await mountScreen().catch(() => {
      // hero จะไม่ขึ้นเพราะ guard — รอการ์ดแทน
    })
    await waitFor(() => expect(screen.getByTestId("destiny-guard-profile")).toBeTruthy())
  })
})
