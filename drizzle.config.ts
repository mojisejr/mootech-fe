import { defineConfig } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// .env.local holds DATABASE_URL (transaction pooler :6543). Introspection/DDL needs a
// session — derive the session pooler (:5432). Runtime uses :6543 (see lib/db/index.ts).
dotenv.config({ path: '.env.local' })
const sessionUrl = (process.env.DATABASE_URL ?? '').replace(':6543', ':5432')

export default defineConfig({
  dialect: 'postgresql',
  out: './lib/db',
  schema: './lib/db/schema.ts',
  dbCredentials: { url: sessionUrl, ssl: 'require' },
})
