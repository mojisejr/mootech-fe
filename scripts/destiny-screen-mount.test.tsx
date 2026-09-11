// scripts/destiny-screen-mount.test.tsx — จอ "ดวงฉัน" (/v2/destiny, Figma node 55349-3070).
// Mounts the REAL DestinyScreen with a fixture (via previewData — the screen's own dev-preview seam) and
// reads what the user sees. CookiesProvider wraps it: TopBarAvatar → useMemberIdentity → useCookies.
//
// 🔴 MUTANT CONTRACT (แต่ละข้อต้องทำให้ npm test แดง):
//   D1  ลบ ปุ่มแชร์ +10 QI หรือปุ่ม Mate AI   → hero share/mate-ai แดง
//   D2  ลบการ์ดคะแนนรายด้าน (domains)          → destiny-domains แดง
//   D3  ลบชิปเสาใด ๆ (ปี/เดือน/วัน/เวลา/ลัคนา) → pillar chips แดง
//   D4  ลบ Life Path chart                     → destiny-life-chart แดง
//   D6  ลบการ์ดชวนเพื่อน                        → destiny-referral แดง
//   D7  fetch /api/destiny 409                 → การ์ด "ข้อมูลวันเกิดยังไม่ครบ" (guard)
import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react"
import { CookiesProvider } from "react-cookie"

vi.mock("next/config", () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))
vi.mock("next/router", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), query: {}, isReady: true }) }))

// recharts' ResponsiveContainer (LifePathChart) needs ResizeObserver — jsdom has none. Polyfill it.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }

const band = (label: string, ageStart: number, ageEnd: number, score: number, stage: string, isCurrent = false) =>
  ({ label, ageStart, ageEnd, score, stage, isCurrent })

const SERIES = [
  band("0-5", 0, 5, 20, "เริ่มใหม่"),
  band("6-10", 6, 10, 48, "สะสม"),
  band("26-30", 26, 30, 95, "โชว์สกิล"),
  band("31-35", 31, 35, 55, "ถดถอย", true),
  band("36-40", 36, 40, 82, "ทดลอง"),
]

const FIXTURE = {
  avatarUrl: null,
  prediction: { personality: "มั่นคง", habit: "รอบคอบ", love: "จริงจัง", work: "ละเอียด" },
  cautions: ["ระวังการเงินช่วงกลางปี"],
  deity: null,
  elementSummary: {
    dayMaster: "甲", dayGanzhi: "甲子", elementTh: "ไม้", tagline: "ผู้สร้างไม่หยุดนิ่ง",
    traits: ["มองไกล", "ริเริ่มเก่ง"], advice: [{ label: "งาน", text: "เสริมด้วยสีเขียว" }],
  },
  lifeTimeline: { currentAge: 31, favorableElementsTh: ["ไฟ"], cautionYears: [{ year: 2027 }] },
  lifePath: { currentAge: 31, favorableElementsTh: ["ไฟ"], series: { all: SERIES, "5y": SERIES, "1y": SERIES, "1m": SERIES } },
  strengthScore: { dayMaster: "甲", strengthScore: 62 },
  domainPower: { domainPower: { wealth: { score: 40 }, career: { score: 95 }, friends: { score: 55 }, learning: { score: 75 } } },
  calculatedState: {
    fourPillars: {
      year: { stem: "乙", branch: "亥" }, month: { stem: "甲", branch: "申" },
      day: { stem: "甲", branch: "子" }, hour: { stem: "庚", branch: "午" },
    },
    mingGong: { stem: "壬", branch: "寅" },
    elementAnalysis: { totalCounts: { wood: 3, fire: 1, earth: 2, metal: 1, water: 1 }, dominantElements: ["wood"], missingElements: ["metal"] },
  },
}

const mountScreen = async () => {
  const { DestinyScreen } = await import("../features/v2-destiny/components/DestinyScreen")
  render(<CookiesProvider>{React.createElement(DestinyScreen, { previewData: FIXTURE } as never)}</CookiesProvider>)
  await waitFor(() => expect(screen.getByTestId("destiny-hero")).toBeTruthy())
}

describe("DestinyScreen (ดวงฉัน, node 55349-3070)", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    // previewData skips the /api/destiny load, but the screen still fires mascot/qi-earn effects — stub
    // fetch benignly so no real/undefined fetch hangs (that was an intermittent 15s timeout under load).
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it("hero: มาสคอต + ชื่อธาตุ + ปุ่มแชร์ +10 QI + Mate AI (D1)", async () => {
    await mountScreen()
    expect(screen.getByText(/คุณธาตุไม้/)).toBeTruthy()
    expect(screen.getByTestId("destiny-share")).toBeTruthy()
    expect(screen.getByTestId("destiny-share-pill")).toBeTruthy()
    expect(screen.getByTestId("destiny-mate-ai")).toBeTruthy()
    expect(screen.getByText(/แชร์ผลทำนายนี้/)).toBeTruthy()
  })

  it("ชิปเสา 5 ตัว เรียงลำดับ ลัคนา ยาม วัน เดือน ปี + ปุ่มโชว์จุดอ่อน (D3)", async () => {
    await mountScreen()
    const pillars = screen.getByTestId("destiny-pillars")
    expect(pillars).toBeTruthy()
    const expected = ["ลัคนา", "ยาม", "วัน", "เดือน", "ปี"]
    for (const p of expected) expect(screen.getByText(p)).toBeTruthy()
    // ต้องเรียงตามลำดับที่กำหนด ไม่ใช่แค่มีครบ
    const labels = Array.from(pillars.querySelectorAll("span"))
      .map((el) => el.textContent?.trim())
      .filter((t) => t && expected.includes(t))
    expect(labels).toEqual(expected)
    expect(screen.getByTestId("destiny-weakness-toggle")).toBeTruthy()
  })

  it("จุดอ่อน 5 ด้าน (โชว์เมื่อกดปุ่ม) + ธาตุมงคล (D2)", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-lucky")).toBeTruthy()
    // destiny-domains ซ่อนอยู่หลังปุ่ม "โชว์จุดอ่อนของ 5 ด้าน" — กดก่อนถึงจะโผล่
    fireEvent.click(screen.getByTestId("destiny-weakness-toggle"))
    await waitFor(() => expect(screen.getByTestId("destiny-domains")).toBeTruthy())
  })

  it("Life Path: การ์ด + กราฟ + แท็บช่วงเวลา (D4)", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-lifepath")).toBeTruthy()
    expect(screen.getByTestId("destiny-life-chart")).toBeTruthy()
    expect(screen.getByTestId("destiny-lifepath-tabs")).toBeTruthy()
  })

  it("จองบริการล่วงหน้า (more) + การ์ดชวนเพื่อน 50 QI (D6)", async () => {
    await mountScreen()
    expect(screen.getByTestId("destiny-more")).toBeTruthy()
    expect(screen.getByTestId("destiny-referral")).toBeTruthy()
    expect(screen.getByText(/ชวนเพื่อนมารับ รับคนละ 50 QI/)).toBeTruthy()
  })

  it("guard: 409 profile_incomplete → การ์ด 'ข้อมูลวันเกิดยังไม่ครบ' (D7)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "profile_incomplete" }), { status: 409 })) as unknown as typeof fetch)
    const { DestinyScreen } = await import("../features/v2-destiny/components/DestinyScreen")
    render(<CookiesProvider>{React.createElement(DestinyScreen)}</CookiesProvider>)
    await waitFor(() => expect(screen.getByTestId("destiny-guard-profile")).toBeTruthy())
  })
})
