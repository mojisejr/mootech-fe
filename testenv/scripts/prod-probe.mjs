#!/usr/bin/env node
// prod-probe — READ-ONLY proof for prod-run (Phase 2). Reads the env that prod-run injected and proves two
// things WITHOUT booting an app and WITHOUT printing any secret:
//   (A) the injected env reaches a REAL database — runs `select 1` (read-only; no table, no write) via psql,
//       using PG* env vars derived in-memory (never placed in argv, never printed).
//   (B) the dangerous-button providers are BLOCKED by default — DNS-resolves the LINE/8x8 hosts (verdict
//       only: NXDOMAIN=blocked vs resolves=LIVE) and checks SendGrid/Omise keys are the neutralized sentinel.
// 🛑 Never UPDATE/DELETE. 🛑 Never print an env value — only "OK / blocked / live / row=N".
import { spawnSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';

const PSQL_CANDIDATES = ['psql', '/opt/homebrew/Cellar/postgresql@17/17.6/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/bin/psql'];
const e = process.env;

// ── (A) DB: derive PG* in memory from DATABASE_URL or DB_* (never printed / never in argv) ──
function pgEnv() {
  const url = e.DATABASE_URL || e.APP_DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return { PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username),
             PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.replace(/^\//, '') || 'postgres' };
  }
  if (e.DB_HOST) return { PGHOST: e.DB_HOST, PGPORT: e.DB_PORT || '5432', PGUSER: e.DB_USERNAME || 'postgres',
                          PGPASSWORD: e.DB_PASSWORD || '', PGDATABASE: e.DB_DATABASE || 'postgres' };
  return null;
}

function dbCheck() {
  const pg = pgEnv();
  if (!pg) return console.log('  (A) DB      : ✗ no DATABASE_URL / DB_HOST in injected env');
  const childEnv = { ...process.env, ...pg, PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '10' };
  let psql = null, r = null;
  for (const p of PSQL_CANDIDATES) {
    r = spawnSync(p, ['-w', '-tAc', 'select 1 as ok'], { env: childEnv, encoding: 'utf8' });
    if (!(r.error && r.error.code === 'ENOENT')) { psql = p; break; }
  }
  if (!psql) return console.log('  (A) DB      : ✗ psql not found');
  const out = (r.stdout || '').trim();
  if (r.status === 0 && out === '1') console.log(`  (A) DB      : ✅ CONNECTED to REAL prod + read-only "select 1" → ${out}  (host family: ${famOf(pg.PGHOST)})`);
  else console.log(`  (A) DB      : ✗ query failed (status=${r.status}) — stderr: ${(r.stderr || '').split('\n')[0].slice(0, 120)}`);
}
function famOf(h) { for (const f of ['supabase.com','supabase.co','neon.tech','render.com','rds.amazonaws.com','localhost']) if ((h||'').includes(f)) return f; return '(custom)'; }

// ── (B) providers: DNS verdict for host-based, sentinel check for key-based (no values printed) ──
async function providerCheck() {
  for (const key of ['LINE_HOST', 'SMS_8X8_HOST']) {
    const v = e[key];
    if (!v) { console.log(`  (B) ${key.padEnd(12)}: (not set)`); continue; }
    let host = v; try { host = new URL(v).hostname; } catch {}
    try { await lookup(host); console.log(`  (B) ${key.padEnd(12)}: 🔴 LIVE — resolves (can reach a real provider)`); }
    catch (err) { console.log(`  (B) ${key.padEnd(12)}: 🟢 BLOCKED — ${err.code || 'no-resolve'} (cannot leave)`); }
  }
  const sg = e.SENDGRID_API_KEY || '';
  console.log(`  (B) SENDGRID    : ${sg.startsWith('SG.blocked-by-prod-run') ? '🟢 key neutralized (auth cannot complete a send)' : (sg ? '🔴 real key present' : '(not set)')}`);
  const om = e.OMISE_SECRET_KEY || '';
  console.log(`  (B) OMISE       : ${om.startsWith('skey_blocked-by-prod-run') ? '🟢 key neutralized (auth cannot complete a charge)' : (om ? '🔴 real key present' : '(not set)')}`);
}

console.log('── prod-probe (read-only) ──');
dbCheck();
await providerCheck();
console.log('── end prod-probe ──');
