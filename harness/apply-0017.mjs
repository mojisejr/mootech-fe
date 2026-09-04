// apply lib/db/0017_qi_packs_reprice.sql to the FE DB (DATABASE_URL). idempotent.
//   cd mootech-fe && node --env-file=.env.local harness/apply-0017.mjs
import postgres from 'postgres'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL
if (!url) { console.error('no DATABASE_URL'); process.exit(1) }
const sql = postgres(url, { prepare: false, ssl: 'require', max: 1 })
const ddl = readFileSync('lib/db/0017_qi_packs_reprice.sql', 'utf8')
const statements = ddl.split('--> statement-breakpoint')
  .map((c) => c.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
  .filter((s) => s.length > 0)

for (const s of statements) await sql.unsafe(s)

const rows = await sql.unsafe(
  "select package_code, amount, is_active from payment_package where tier_code='QI' order by amount",
)
console.log('QI packs now:')
for (const r of rows) console.log(` ${r.package_code}  THB ${r.amount}  active=${r.is_active}`)
await sql.end()
