// Register + edit-birth write, moved off mootech-be (mumate-be-retirement-001 slice 1, plan rev 0.4 1b).
//
// What BE's POST /chinese-horoscope did for a signed-in caller (be chinese-horoscope.service.ts:919-976,
// user.service.ts:830-855), and what this keeps:
//   • log_calculate: one row — user_id, createAt (Bangkok 'YYYY-MM-DD HH:mm:ss'), name '' (BE wrote ''),
//     dob, time, gender, is_remember_time = time != '', place_name, a random 12-char `code`, result JSON.
//     KEPT, with a MINIMAL result JSON (the engine-derived chart v2 reads, not BE's full analytic blob):
//     the row exists so /ops calc metrics (lib/ops/metrics.ts:69) keep counting charts.
//   • user: dob, time, is_remember_time, gender, result_code = that code, place_name, is_refresh = false,
//     name, surname, picture_url, account_name. KEPT, with BE's TypeORM rule that a field the caller did
//     not send is left alone (TypeORM skips undefined on save). `time` is '' when unknown, never NULL.
//   • share-card JPEG to S3 + user.share_img_profile_url. DROPPED (no v2 reader).
//   • family_code -> member_payment_code. DROPPED (v2 always sent '').
// What changes: identity comes from the session (the route), never the body; the two writes are one
// transaction; the chart comes from the bazi engine and is best-effort — the member is registered even
// when the engine is down, because home and first-run compute the chart live anyway.
import { eq } from 'drizzle-orm'
import { logCalculate, user } from '@/lib/db/schema'
import { bkkTimestamp } from '@/lib/usage-core'
import { generateResultCode, normalizeChartGender, type ChartPayload } from './engine-chart'

const DOB_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_TEXT = 255 // log_calculate.name/place_name are varchar(255); the rest is held to the same bound

export type BirthChartInput = {
  dob: string
  time: string // '' = unknown
  gender?: 'MALE' | 'FEMALE' // omitted = keep the stored gender
  name?: string
  surname?: string
  pictureUrl?: string
  accountName?: string
  placeName?: string
}

/** Validate the request body. Returns null on anything malformed. Identity fields in the body
 *  (user_id, userId, …) are not read at all. */
export function parseBirthChartBody(body: unknown): BirthChartInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.dob !== 'string' || !DOB_RE.test(b.dob)) return null
  const d = new Date(`${b.dob}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== b.dob) return null // 2026-02-31

  let time = ''
  if (b.time !== undefined && b.time !== null) {
    if (typeof b.time !== 'string') return null
    time = b.time.trim()
    if (time !== '' && !TIME_RE.test(time)) return null
  }

  const out: BirthChartInput = { dob: b.dob, time }
  if (b.gender !== undefined && b.gender !== null && b.gender !== '') {
    const g = normalizeChartGender(b.gender)
    if (!g) return null
    out.gender = g
  }
  const text = (k: string): string | undefined | null => {
    const v = b[k]
    if (v === undefined || v === null) return undefined
    if (typeof v !== 'string' || v.length > MAX_TEXT) return null
    return v
  }
  const fields: Array<[keyof BirthChartInput, string]> = [
    ['name', 'name'],
    ['surname', 'surname'],
    ['pictureUrl', 'picture_url'],
    ['accountName', 'account_name'],
    ['placeName', 'place_name'],
  ]
  for (const [key, wire] of fields) {
    const v = text(wire)
    if (v === null) return null
    if (v !== undefined) (out as Record<string, unknown>)[key] = v
  }
  return out
}

export type LogCalculateRow = {
  userId: string
  createat: string
  name: string
  dob: string
  time: string
  gender: string | null
  isRememberTime: boolean
  placeName: string | null
  code: string
  result: string
}

export type UserChartUpdate = {
  dob: string
  time: string
  isRememberTime: boolean
  resultCode: string
  isRefresh: false
  gender?: string
  placeName?: string
  name?: string
  surname?: string
  pictureUrl?: string
  accountName?: string
}

export type BirthChartWrite = { userId: string; log: LogCalculateRow; user: UserChartUpdate }

export type BirthChartStore = {
  /** The stored gender (and place) the write falls back to when the caller does not send one. */
  readMember(userId: string): Promise<{ gender: string | null; placeName: string | null } | null>
  /** Both writes, atomically. false = no such member (nothing written). */
  save(write: BirthChartWrite): Promise<boolean>
}

/** The minimal `log_calculate.result` JSON. With the engine: the chart payload v2 reads. Without it
 *  (engine down): the birth only, marked, so nobody mistakes it for a chart. */
export function minimalResultJson(
  birth: { dob: string; time: string; gender: string },
  chart: ChartPayload | null,
): string {
  return JSON.stringify(chart ?? { source: 'bazi-engine', engine: 'unavailable', ...birth })
}

/** Build the two writes for one save. PURE (clock and code injected) so the shape is testable. */
export function buildBirthChartWrite(
  userId: string,
  input: BirthChartInput,
  effectiveGender: string | null,
  chart: ChartPayload | null,
  deps: { now?: Date; code?: string } = {},
): BirthChartWrite {
  const code = deps.code ?? generateResultCode()
  const time = input.time // '' when unknown — user.time is NOT NULL
  const isRememberTime = time !== ''
  const upd: UserChartUpdate = { dob: input.dob, time, isRememberTime, resultCode: code, isRefresh: false }
  if (input.gender !== undefined) upd.gender = input.gender
  if (input.placeName !== undefined) upd.placeName = input.placeName
  if (input.name !== undefined) upd.name = input.name
  if (input.surname !== undefined) upd.surname = input.surname
  if (input.pictureUrl !== undefined) upd.pictureUrl = input.pictureUrl
  if (input.accountName !== undefined) upd.accountName = input.accountName
  return {
    userId,
    user: upd,
    log: {
      userId,
      createat: bkkTimestamp(deps.now ?? new Date()),
      name: '',
      dob: input.dob,
      time,
      gender: effectiveGender,
      isRememberTime,
      placeName: input.placeName ?? null,
      code,
      result: minimalResultJson({ dob: input.dob, time, gender: effectiveGender ?? '' }, chart),
    },
  }
}

export type SaveBirthChartResult = { ok: true; code: string; chart: ChartPayload | null } | { ok: false; status: 404 }

/** The whole save: stored gender fallback -> engine chart (best-effort) -> one transaction. */
export async function saveBirthChart(
  store: BirthChartStore,
  userId: string,
  input: BirthChartInput,
  computeChart: (birth: { dob: string; time: string; gender: string | null; place_name: string | null }) => Promise<ChartPayload>,
  deps: { now?: Date; code?: string; onEngineError?: (e: unknown) => void } = {},
): Promise<SaveBirthChartResult> {
  const member = await store.readMember(userId)
  if (!member) return { ok: false, status: 404 }
  const gender = input.gender ?? normalizeChartGender(member.gender) ?? member.gender ?? null
  let chart: ChartPayload | null = null
  try {
    chart = await computeChart({ dob: input.dob, time: input.time, gender, place_name: input.placeName ?? member.placeName })
  } catch (e) {
    deps.onEngineError?.(e)
    chart = null
  }
  const write = buildBirthChartWrite(userId, input, gender, chart, deps)
  const saved = await store.save(write)
  if (!saved) return { ok: false, status: 404 }
  return { ok: true, code: write.log.code, chart }
}

// ---- Postgres store --------------------------------------------------------------------------------

type Tx = {
  update: (t: typeof user) => any
  insert: (t: typeof logCalculate) => any
  select: (...a: any[]) => any
}
type TransactionDatabase = Tx & { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> }

class NoSuchMember extends Error {}

/** 🔴 Every statement inside the transaction goes through `tx`, never the module `db`: the app pool is
 *  ONE connection (lib/db/index.ts), and a `db` call inside a transaction waits for itself forever
 *  (the link-account.ts self-deadlock). */
export function createPostgresBirthChartStore(database: TransactionDatabase): BirthChartStore {
  return {
    async readMember(userId) {
      const rows = (await database
        .select({ gender: user.gender, placeName: user.placeName })
        .from(user)
        .where(eq(user.userId, userId))
        .limit(1)) as Array<{ gender: string | null; placeName: string | null }>
      return rows[0] ?? null
    },
    async save(write) {
      try {
        await database.transaction(async (tx) => {
          const updated = (await tx
            .update(user)
            .set(write.user)
            .where(eq(user.userId, write.userId))
            .returning({ userId: user.userId })) as unknown[]
          if (updated.length !== 1) throw new NoSuchMember()
          await tx.insert(logCalculate).values(write.log)
        })
        return true
      } catch (e) {
        if (e instanceof NoSuchMember) return false
        throw e
      }
    },
  }
}
