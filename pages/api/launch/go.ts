// POST /api/launch/go — THE go-live action (#606): maintenance off + drop v2 lock + redeploy.
// Requires body { confirm: true } so it can never fire on an accidental/empty POST. Gated at the edge
// (middleware) AND here (isLaunchAuthed). This is pressed by เอ็ม from /launch at the ฤกษ์ — the agent
// never calls it. `?dryRun=1` returns the plan without touching anything (for verifying on the day).
import type { NextApiRequest, NextApiResponse } from "next";
import { isLaunchAuthed } from "@/lib/launch/auth";
import { goLive, isLaunchArmed, readEnvState } from "@/lib/launch/vercel";

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
  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  const plan = ["MAINTENANCE_MODE=off", "ลบ V2_PREVIEW_KEY", "redeploy production"];
  if (dryRun) {
    let env = null;
    try { env = await readEnvState(); } catch { /* best-effort */ }
    res.status(200).json({ dryRun: true, plan, currentEnv: env });
    return;
  }
  if ((req.body as { confirm?: boolean })?.confirm !== true) {
    res.status(400).json({ error: { message: "ต้องส่ง confirm:true เพื่อยืนยันการเปิดระบบ" } });
    return;
  }
  try {
    await goLive();
    res.status(200).json({ ok: true, launched: true, plan, note: "กำลัง redeploy — เว็บจะเปิดสู่ผู้ใช้ภายใน ~1-2 นาที" });
  } catch (e) {
    res.status(502).json({ error: { message: e instanceof Error ? e.message : "go-live failed" } });
  }
}
