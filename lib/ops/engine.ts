// เรียก engine admin routes (secret-gated) จาก /ops ฝั่ง FE — ข้อมูลฝั่ง engine (QI, bazi_user_profile)
// อยู่คนละ DB ต้องผ่าน HTTP. ใช้ OPS_ADMIN_SECRET (แยกจาก QI_GRANT_SECRET). fail-closed ถ้าไม่ตั้ง env.
const ENGINE_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'

export type OpsEngineResult = { ok: boolean; status: number; json: Record<string, unknown> }

function noSecret(): OpsEngineResult {
  return { ok: false, status: 501, json: { error: 'OPS_ADMIN_SECRET not set' } }
}

async function parse(r: Response): Promise<OpsEngineResult> {
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: r.ok, status: r.status, json }
}

/** GET — secret ไปทาง header x-ops-secret (ไม่ใส่ใน URL) */
export async function opsEngineGet(path: string): Promise<OpsEngineResult> {
  const secret = process.env.OPS_ADMIN_SECRET
  if (!secret) return noSecret()
  try {
    return await parse(await fetch(`${ENGINE_BASE}${path}`, { headers: { 'x-ops-secret': secret } }))
  } catch {
    return { ok: false, status: 502, json: { error: 'engine unreachable' } }
  }
}

/** POST/PATCH — secret ไปใน body (เหมือน /api/qi/grant) */
export async function opsEngineWrite(
  method: 'POST' | 'PATCH',
  path: string,
  body: Record<string, unknown>,
): Promise<OpsEngineResult> {
  const secret = process.env.OPS_ADMIN_SECRET
  if (!secret) return noSecret()
  try {
    return await parse(
      await fetch(`${ENGINE_BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, secret }),
      }),
    )
  } catch {
    return { ok: false, status: 502, json: { error: 'engine unreachable' } }
  }
}
