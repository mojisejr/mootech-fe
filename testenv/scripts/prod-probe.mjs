#!/usr/bin/env node
// prod-probe — READ-ONLY provider-reachability verdict for prod-run's `--with-providers` policy. Reads the env
// prod-run injected and reports whether the dangerous-button providers are BLOCKED (default) or LIVE, WITHOUT
// sending anything and WITHOUT printing a secret:
//   • host-based (LINE/8x8): DNS-resolve the host — verdict only (NXDOMAIN=blocked vs resolves=LIVE).
//   • key-based (SendGrid/Omise, host hardcoded in the SDK): check the key is the neutralized sentinel.
// The DB is verified by prod-run's own pre-flight (same `postgres` client the app uses) — not here, so this
// probe needs no DB client and no psql. 🛑 Never fires a provider. 🛑 Never prints an env value.
import { lookup } from 'node:dns/promises';

const e = process.env;
console.log('── prod-probe (read-only provider verdict) ──');

for (const key of ['LINE_HOST', 'SMS_8X8_HOST']) {
  const v = e[key];
  if (!v) { console.log(`  ${key.padEnd(12)}: (not set)`); continue; }
  let host = v; try { host = new URL(v).hostname; } catch { /* use raw */ }
  try { await lookup(host); console.log(`  ${key.padEnd(12)}: 🔴 LIVE — resolves (can reach a real provider)`); }
  catch (err) { console.log(`  ${key.padEnd(12)}: 🟢 BLOCKED — ${err.code || 'no-resolve'} (cannot leave)`); }
}
const sg = e.SENDGRID_API_KEY || '';
console.log(`  SENDGRID    : ${sg.startsWith('SG.blocked-by-prod-run') ? '🟢 key neutralized (auth cannot complete a send)' : (sg ? '🔴 real key present' : '(not set)')}`);
const om = e.OMISE_SECRET_KEY || '';
console.log(`  OMISE       : ${om.startsWith('skey_blocked-by-prod-run') ? '🟢 key neutralized (auth cannot complete a charge)' : (om ? '🔴 real key present' : '(not set)')}`);
console.log('── end prod-probe ──');
