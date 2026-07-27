#!/usr/bin/env node
// ANCHOR: awareness-mode-banner — first line on every dev; unknown => STOP (exit non-zero)
// mode-banner — Layer 1 of "3 layers of awareness". Runs as `predev` so EVERY `npm run dev` prints, as its
// FIRST line before the app boots, which world it is pointing at — read from the REAL env on disk, not a doc
// or a memory or a marker:
//   🟢 practice field  — the local test DB. proceed.
//   🔴 REAL production  — show only the host FAMILY (never an env value). proceed, but loud.
//   ⚪ unknown          — can't tell which mode → STOP (exit non-zero → npm aborts `dev`). can't-verify ≠ safe.
// Reads the CWD's .env* the way Next resolves them for `dev` (development), excluding *.testenv-shadowed /
// .example / .disabled. Never prints an env value — only a host family + the mode.  🛑 read-only, no side effects.
import { readFileSync, existsSync } from 'node:fs';

const label = process.argv[2] || '';                       // optional display label (app name)
// Next dev precedence, highest first (a var is taken from the first file that defines it):
const FILES = ['.env.development.local', '.env.local', '.env.development', '.env'];
const PROD = [/supabase\.com/, /supabase\.co/, /neon\.tech/, /\.onrender\.com/, /render\.com/, /\.rds\.amazonaws\.com/, /pooler\.supabase/];
const LOCAL = ['localhost', '127.0.0.1', 'host.docker.internal'];

function effective(key) {                                   // first file (by precedence) that defines key
  for (const f of FILES) {
    if (!existsSync(f)) continue;
    let raw; try { raw = readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1 || t.slice(0, eq).trim() !== key) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  }
  return undefined;
}
function hostOf(v) { if (!v) return null; try { return v.includes('://') ? new URL(v).hostname : v.split('@').pop().split(/[:/]/)[0]; } catch { return null; } }
function classify(host) {
  if (!host) return { mode: 'unknown', fam: null };
  if (LOCAL.some((l) => host === l || host.startsWith(l))) return { mode: 'local', fam: 'localhost' };
  const p = PROD.find((re) => re.test(host));
  if (p) return { mode: 'prod', fam: (host.match(/[a-z0-9-]+\.(supabase\.(com|co)|neon\.tech|onrender\.com|render\.com|rds\.amazonaws\.com)/i) || [])[0]?.replace(/^[a-z0-9-]+\./, '') || 'prod-host' };
  return { mode: 'remote-unknown', fam: null };            // a non-local host we don't recognize → treat as unknown
}

const db = classify(hostOf(effective('DATABASE_URL') || effective('APP_DATABASE_URL')));
const be = classify(hostOf(effective('NEXT_PUBLIC_BACKEND_URL')));
const who = label ? `[${label}] ` : '';

if (db.mode === 'local') {
  console.log(`🟢 ${who}สนามซ้อม — DB: localhost · backend: ${be.mode === 'local' ? 'localhost' : (be.fam || 'ไม่ทราบ')} · ทำอะไรก็ได้ (ปลอดภัย)`);
  process.exit(0);
}
if (db.mode === 'prod') {
  // "remote/real" — NOT the practice field. Deliberately does NOT claim "production": a supabase host may be
  // the prod OR the paused dev project; `stack.sh status` makes the finer dev/prod/neon call. Either way: careful.
  console.log(`🔴 ${who}ของจริง (remote — ไม่ใช่สนามซ้อม) — DB: ${db.fam} · backend: ${be.mode === 'local' ? 'localhost' : (be.fam || '?')} · ⚠️ ระวัง (เช็คให้ชัด: stack.sh status)`);
  process.exit(0);
}
// unknown / remote-unknown / no DATABASE_URL → STOP
const reason = db.mode === 'unknown' ? 'ไม่พบ DATABASE_URL ในไฟล์ env' : 'DATABASE_URL ชี้ host ที่ไม่รู้จัก (ไม่ใช่ทั้ง local และ prod ที่รู้จัก)';
console.error(`⚪ ${who}ไม่รู้ว่าอยู่โหมดไหน — ${reason} → หยุด (ไม่บูตทั้งที่ยังไม่รู้ว่าชี้ไปไหน)
   เช็คยังไง: bash testenv/scripts/stack.sh status
   เปิดสนามซ้อม: bash testenv/scripts/stack.sh up`);
process.exit(1);
