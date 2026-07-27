#!/usr/bin/env node
// prod-run — Phase 2 of "local safe-by-default". Inject a REAL prod env blob from ~/.mumate-prod/ into a
// process for ONE command, then vanish. NO file is ever written to disk (no temp/backup/marker) — the env
// lives only in the spawned child's memory. Connecting to prod ≠ firing prod: by DEFAULT the outbound
// dangerous-button providers (SMS/LINE/email/payment) are neutralized so an accidental call cannot leave;
// `--with-providers` re-arms them and demands a second, distinct confirmation.
//
// Usage:  node prod-run.mjs [--with-providers] <fe|be|bazi> -- <command> [args...]
//
// Hard rules baked in (Phase 2 spec):
//   1. never writes to disk        2. loud banner (app + which prod DB, no secrets)
//   3. typed confirmation (the app name — never y/Enter)   4. NEVER prints an env value, even on error
//   5. providers blocked by default   + refuses `build` (browser vars bake at build → unsupported, would
//      fail SILENTLY, so refuse loudly instead).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const VAULT = join(homedir(), '.mumate-prod');

// Project topology (declared in the vault file headers since 2026-06-19; ฟีม-confirmed 2026-07-27):
//   soxsccdlsycaevusndro = PROD (real)  ·  jgxsjhbdhttfoiyvptvy = DEV (de-prod'd 2026-06-19, now paused)  ·  Neon = backup DB
// The two files holding real PROD keys: be.env.prod.local (soxsc) + be.env.local (SUPABASE_REAL_PRODUCTION_URL +
// service-role). The other 4 blobs are DEV/backup. So:
const APP_BLOB = {
  be: 'be.env.prod.local',   // mootech-be → PROD (soxsc), ฟีม-confirmed. 🛑 ฟีม approval required each use.
  bazi: 'bazi.env.local',    // bazi → Neon backup DB (ฟีม: pointing here is fine).
};
// fe has NO prod blob on disk — fe.env.local is the DEV project (jgxsj), NOT prod. Refuse rather than silently
// connect to dev believing it's prod. (ฟีม: do not substitute fe.env.local.)
const NO_PROD_KEY = { fe: true };

// dangerous-button providers neutralized by DEFAULT (connect-real ≠ fire-real).
// host-based (LINE/8x8) → RFC-2606 .invalid (network-dead, same as #184); key-based providers whose host is
// hardcoded in the SDK (SendGrid/Omise) → a sentinel dummy key so auth can't complete a real send/charge.
const NEUTRALIZE = {
  LINE_HOST: 'https://line.invalid',
  SMS_8X8_HOST: 'https://sms.8x8.invalid',
  SENDGRID_API_KEY: 'SG.blocked-by-prod-run',
  OMISE_SECRET_KEY: 'skey_blocked-by-prod-run',
  OMISE_PUBLIC_KEY: 'pkey_blocked-by-prod-run',
  OMISE_WEBHOOK_SECRET: 'blocked-by-prod-run',
};

const die = (msg, code = 1) => { console.error(`\n🛑 prod-run: ${msg}\n`); process.exit(code); };

const PSQL = ['psql', '/opt/homebrew/Cellar/postgresql@17/17.6/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/bin/psql'];

// PRE-FLIGHT (fix #1): before running the real command, verify the injected creds actually reach a live prod
// DB with a READ-ONLY `select 1`. This is correct NO MATTER WHICH blob an app maps to — if the app→file map
// is wrong (it is currently UNVERIFIED — see #2/PR), the run fails LOUD here instead of silently deep inside
// the app (ตู๋'s lens #5). Uses psql (no npm dep); if psql is absent the check is skipped with a warning.
// Never prints an env value — only a category verdict.
// ANCHOR: preflight-fail-loud — dead/unreachable prod DB → refuse before spawn (fail loud, not silent).
function preflightDb(env) {
  let pg;
  const url = env.DATABASE_URL || env.APP_DATABASE_URL;
  if (url) {
    try { const u = new URL(url); pg = { PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.replace(/^\//, '') || 'postgres' }; }
    catch { return { cat: 'bad-url' }; }
  } else if (env.DB_HOST) {
    pg = { PGHOST: env.DB_HOST, PGPORT: env.DB_PORT || '5432', PGUSER: env.DB_USERNAME || 'postgres', PGPASSWORD: env.DB_PASSWORD || '', PGDATABASE: env.DB_DATABASE || 'postgres' };
  } else {
    return { cat: 'no-db-var' };
  }
  const childEnv = { ...process.env, ...pg, PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '12' };
  for (const p of PSQL) {
    const r = spawnSync(p, ['-w', '-tAc', 'select 1'], { env: childEnv, encoding: 'utf8' });
    if (r.error && r.error.code === 'ENOENT') continue;              // try next psql path
    if (r.status === 0 && (r.stdout || '').trim() === '1') return { cat: 'ok' };
    const s = (r.stderr || '').toLowerCase();                        // categorize ONLY — never echo (holds the username)
    if (/tenant.*not found|user.*not found/.test(s)) return { cat: 'tenant-not-found' };
    if (/password authentication failed|authentication failed/.test(s)) return { cat: 'auth-failed' };
    return { cat: 'connect-failed' };
  }
  return { cat: 'no-psql' };
}

// ── parse args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const withProviders = argv[0] === '--with-providers';
const rest = withProviders ? argv.slice(1) : argv;
const app = rest[0];
const sep = rest.indexOf('--');
if (NO_PROD_KEY[app]) {
  die(`no PROD credentials for "${app}" on disk.\n` +
      `   The only ${app} blob we have is the DEV project (jgxsj), not prod — refusing rather than connecting\n` +
      `   to DEV believing it is prod. We do NOT have ${app}'s prod key. Ask ฟีม for it; do not substitute the dev blob.`, 4);
}
if (!app || !APP_BLOB[app]) die(`first arg must be one of: ${Object.keys(APP_BLOB).join(', ')} (fe = no prod key on disk)`, 2);
if (sep === -1 || sep === rest.length - 1) die('missing command — usage: prod-run [--with-providers] <app> -- <command...>', 2);
const cmd = rest.slice(sep + 1);

// ── refuse `build` (risk #7: NEXT_PUBLIC_* bake at build time; prod-run injects at RUNTIME, so a prod build
//    would silently ship stale/wrong browser values — no error. Refuse loudly, don't half-support). ──
if (/\bbuild\b/.test(cmd.join(' '))) {
  die(`refusing a "build" command.\n   NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time,\n   but prod-run injects env at RUN time — a prod build here would bake WRONG browser values and fail\n   SILENTLY (no error). Building against prod is not supported by prod-run yet. Build another way, or ask\n   บอง/ฟีม to design a build-time path.`, 3);
}

// ── load the vault blob (dotenv; header lines are #comments → ignored for free) ──
let raw;
try { raw = readFileSync(join(VAULT, APP_BLOB[app]), 'utf8'); }
catch { die(`cannot read ~/.mumate-prod/${APP_BLOB[app]} — run Phase 1 first (or check perms 700/600)`, 4); }
const parsed = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;               // skip blanks + comments (incl. the warning header)
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (k) parsed[k] = v;
}
if (Object.keys(parsed).length === 0) die(`no env keys parsed from the vault blob — aborting (won't run with an empty prod env)`, 4);

// ── provider policy ──────────────────────────────────────────────────────────
let providerMode;
if (withProviders) {
  providerMode = 'LIVE';
} else {
  for (const [k, val] of Object.entries(NEUTRALIZE)) if (k in parsed) parsed[k] = val;
  providerMode = 'BLOCKED';
}

// ── derive a NON-SECRET label for "which prod DB" (never print the raw value) ──
function dbFamily() {
  const src = parsed.DATABASE_URL || parsed.APP_DATABASE_URL || parsed.DB_HOST || '';
  let host = src;
  try { if (src.includes('://')) host = new URL(src).hostname; } catch { /* fall through */ }
  for (const fam of ['supabase.com', 'supabase.co', 'neon.tech', 'render.com', 'rds.amazonaws.com', 'localhost', '127.0.0.1']) {
    if (host.includes(fam)) return fam;
  }
  return host ? '(custom host — hidden)' : '(no DB host in blob)';
}

// ── loud banner ────────────────────────────────────────────────────────────────
console.error('');
console.error('  ╔══════════════════════════════════════════════════════════════════╗');
console.error('  ║  🔴🔴🔴   prod-run — CONNECTING TO REAL PRODUCTION   🔴🔴🔴        ║');
console.error('  ╚══════════════════════════════════════════════════════════════════╝');
console.error(`     app        : ${app}`);
console.error(`     prod DB    : ${dbFamily()}   ← REAL production database`);
console.error(`     providers  : ${providerMode === 'LIVE'
  ? '🔴 LIVE — SMS/LINE/email/payment CAN FIRE for real'
  : '🟢 BLOCKED — SMS/LINE/email/payment neutralized (cannot leave)'}`);
console.error(`     command    : ${cmd.join(' ')}`);
console.error('     (env is injected into this one command only · nothing is written to disk)');
console.error('');

// ── require a REAL terminal — the confirmation must be hand-typed, never piped/automated ──
// (ตู๋ lens #3: a fakeable confirmation is no gate. `echo be | prod-run …` — and worse
// `printf 'be\nSEND-REAL\n' | prod-run --with-providers …` — must NOT be able to auto-confirm live SMS/payment.)
if (!process.stdin.isTTY) {
  die(`this command must be confirmed by a HUMAN at a real terminal.\n` +
      `   It refuses a pipe / redirected / automated stdin BY DESIGN — so no script can auto-confirm connecting\n` +
      `   to prod (or, with --with-providers, firing real SMS/LINE/payment). Run it in an interactive shell and\n` +
      `   type the confirmation by hand.`, 6);
}

// ── typed confirmation (never y/Enter — must type the app name) ──
const rl = createInterface({ input: process.stdin, output: process.stderr });
const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a)));

const conf1 = (await ask(`  Type "${app}" to connect to REAL PROD (anything else aborts): `)).trim();
if (conf1 !== app) { rl.close(); die(`not confirmed (expected "${app}") — nothing ran.`, 2); }

if (withProviders) {
  const conf2 = (await ask(`  ⚠️  LIVE PROVIDERS: type "SEND-REAL" to allow real SMS/LINE/email/payment: `)).trim();
  if (conf2 !== 'SEND-REAL') { rl.close(); die(`live-providers not confirmed — nothing ran.`, 2); }
}
rl.close();

// ── pre-flight the DB (fix #1) — fail LOUD, never silent ──
console.error('  ⏳ pre-flight: verifying this blob reaches a live prod DB (read-only select 1)…');
const pf = preflightDb(parsed);
if (pf.cat === 'ok') {
  console.error('  ✅ pre-flight: prod DB reachable — proceeding.\n');
} else if (pf.cat === 'no-db-var') {
  console.error('  ⚠️  pre-flight: this blob has no DATABASE_URL/DB_HOST — skipping DB check (nothing to verify).\n');
} else if (pf.cat === 'no-psql') {
  console.error('  ⚠️  pre-flight: psql not found — cannot verify the prod DB; proceeding UNVERIFIED (install psql to enable the check).\n');
} else {
  // human 3-part message: why · what it means · what to do  (NO env value)
  const why = {
    'tenant-not-found': 'the database pooler did not recognize this project (tenant/user not found) — it may be responding-as-none / paused.',
    'auth-failed': 'the prod database REJECTED the credentials (authentication failed).',
    'connect-failed': 'could not reach the prod database (network / wrong host / timeout).',
    'bad-url': 'the DATABASE_URL in this blob is not a parseable URL.',
  }[pf.cat] || 'the prod database connection failed.';
  const means = {
    'tenant-not-found': 'this blob points at DEV (or a paused tenant), NOT prod — DEV is not broken, it is simply a different place. Real prod is soxsc in be.env.prod.local.',
    'auth-failed': 'the user/password in this blob is wrong or has been rotated.',
    'connect-failed': 'the host may be an IP allowlist, a wrong/old endpoint, or the DB is down.',
    'bad-url': 'the blob is malformed.',
  }[pf.cat] || 'these credentials may be stale or wrong.';
  die(`pre-flight FAILED — NOT running the command (this is by design: fail loud, not silent).\n` +
      `   why  : ${why}\n` +
      `   means: ${means}\n` +
      `   do   : do NOT guess another blob. Ask ฟีม which file holds the CURRENT prod creds for "${app}".\n` +
      `          (prod-run's app→file mapping is still UNVERIFIED — the ref may be dead; see the PR.)`, 5);
}

// ── run: inject into the child's env ONLY (no temp file) ──
const child = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, ...parsed }, stdio: 'inherit' });
child.on('exit', (code, sig) => process.exit(sig ? 1 : (code ?? 0)));
child.on('error', (e) => die(`failed to start command "${cmd[0]}": ${e.code || e.message}`, 1));
