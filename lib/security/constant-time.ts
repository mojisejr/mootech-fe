// lib/security/constant-time.ts — constant-time string comparison for secret/cookie checks (Node runtime).
// Length is compared first (leaking only length, which for fixed random keys is not sensitive), then
// crypto.timingSafeEqual on equal-length buffers. Not usable in the Edge middleware (no node:crypto there);
// middleware keeps a plain === on high-entropy keys, which is not a practical timing target over the network.
import { timingSafeEqual } from "node:crypto";

export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
