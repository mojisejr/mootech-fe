// POST /api/launch/rollback — emergency close: maintenance ON + redeploy. Once V2_PREVIEW_KEY is gone,
// turning maintenance on covers the whole site (v1 + v2) — see lib/launch/vercel.ts header. Requires
// body { confirm: true }. Gated at the edge (middleware) AND here (isLaunchAuthed).
import type { NextApiRequest, NextApiResponse } from "next";
import { isLaunchAuthed } from "@/lib/launch/auth";
import { isLaunchArmed, rollback } from "@/lib/launch/vercel";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  if (!isLaunchAuthed(req)) {
    res.status(401).json({ error: { message: "Not authenticated" } });
    return;
  }
  const armed = isLaunchArmed();
  if (!armed.armed) {
    res.status(409).json({ error: { message: `ยังไม่พร้อม: ตั้งค่า ${armed.missing.join(", ")} ก่อน` } });
    return;
  }
  if ((req.body as { confirm?: boolean })?.confirm !== true) {
    res.status(400).json({ error: { message: "ต้องส่ง confirm:true เพื่อยืนยันการปิดระบบ" } });
    return;
  }
  try {
    await rollback();
    res.status(200).json({ ok: true, note: "กำลัง redeploy — เว็บจะกลับเข้าสู่โหมดปิดปรับปรุงภายใน ~1-2 นาที" });
  } catch (e) {
    res.status(502).json({ error: { message: e instanceof Error ? e.message : "rollback failed" } });
  }
}
