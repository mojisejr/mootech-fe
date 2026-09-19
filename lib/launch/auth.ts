// lib/launch/auth.ts — shared cookie check for the launch console (Node runtime; used by pages + API).
// middleware.ts gates /launch + /api/launch/* at the edge, but every route re-checks here (defense in
// depth, same discipline as lib/v2/gate.ts). Fail closed: no LAUNCH_KEY configured = not authenticated.
import type { NextApiRequest } from "next";
import { safeEqual } from "@/lib/security/constant-time";

export const LAUNCH_COOKIE = "launch_access";

export function isLaunchAuthed(
  req: NextApiRequest | { cookies: Partial<Record<string, string>> },
): boolean {
  const key = process.env.LAUNCH_KEY;
  if (!key) return false;
  return safeEqual(req.cookies?.[LAUNCH_COOKIE], key);
}
