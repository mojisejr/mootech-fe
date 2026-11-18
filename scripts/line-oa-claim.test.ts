// scripts/line-oa-claim.test.ts — แอด LINE OA รับ 100 Qi: ต้องเช็กเพื่อนกับ LINE ก่อนจ่าย + /api/qi-earn ห้ามรับโค้ดนี้ตรง
import { describe, it, expect, vi, beforeEach } from "vitest"

const tok: { v: Record<string, unknown> | null } = { v: { provider: "line", accessToken: "t" } }
vi.mock("next-auth/jwt", () => ({ getToken: async () => tok.v }))
vi.mock("@/lib/v2/resolve-user", () => ({ resolveRouteMember: async () => ({ ok: true, userId: "u1" }) }))
const engine = vi.fn(async () => new Response(JSON.stringify({ awarded: 100, capped: false }), { status: 200 }))
vi.mock("@/lib/bazi/fetch", () => ({ baziFetch: (...a: unknown[]) => engine(...(a as [])) }))

const run = async (mod: string, body: unknown = {}) => {
  const h = (await import(mod)).default
  let status = 0, json: Record<string, unknown> = {}
  const res = { status: (s: number) => { status = s; return res }, json: (j: Record<string, unknown>) => { json = j; return res } }
  await h({ method: "POST", body } as never, res as never)
  return { status, json }
}
let friend = true, lineStatus = 200
beforeEach(() => {
  tok.v = { provider: "line", accessToken: "t" }; friend = true; lineStatus = 200; engine.mockClear()
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ friendFlag: friend }), { status: lineStatus })))
})

describe("line-oa-claim", () => {
  it("เพื่อนแล้ว → จ่ายผ่าน engine code line_oa_add", async () => {
    const r = await run("@/pages/api/v2/line-oa-claim")
    expect(r.status).toBe(200)
    expect(JSON.parse(String((engine.mock.calls[0] as unknown[])[1] && ((engine.mock.calls[0] as unknown[])[1] as { body: string }).body)).code).toBe("line_oa_add")
  })
  it("ยังไม่แอด → 409 ไม่จ่าย", async () => {
    friend = false
    const r = await run("@/pages/api/v2/line-oa-claim")
    expect(r.status).toBe(409); expect(engine).not.toHaveBeenCalled()
  })
  it("ไม่ใช่ LINE login → 400", async () => {
    tok.v = { provider: "google", accessToken: "g" }
    expect((await run("@/pages/api/v2/line-oa-claim")).status).toBe(400)
  })
  it("token LINE หมดอายุ → 401 relogin", async () => {
    lineStatus = 401
    expect((await run("@/pages/api/v2/line-oa-claim")).json.reason).toBe("relogin")
  })
  it("/api/qi-earn รับ line_oa_add ตรงไม่ได้", async () => {
    const r = await run("@/pages/api/qi-earn", { code: "line_oa_add" })
    expect(r.status).toBe(403); expect(engine).not.toHaveBeenCalled()
  })
})
