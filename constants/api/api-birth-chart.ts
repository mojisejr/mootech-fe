import { API } from './endpoint'
import { UnverifiedApiResult } from './unverified-result'

// v2 register + edit-birth save (mumate-be-retirement-001 slice 1) -> POST /api/v2/birth-chart.
// Identity is the session on the server; no user_id is sent. Fields left undefined are not changed.
// Answers { code } (the new result_code) or an `{ error }` body; callers read `code`. Plain same-origin
// fetch (the session cookie rides along); never throws.
export type SaveBirthChartBody = {
  dob: string
  time: string // '' = unknown
  gender?: 'MALE' | 'FEMALE'
  name?: string
  surname?: string
  picture_url?: string
  account_name?: string
}

export const SaveBirthChart = async (body: SaveBirthChartBody): Promise<UnverifiedApiResult> => {
  try {
    const res = await fetch(API.chinese_horoscope.save_birth, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json().catch(() => null)) as UnverifiedApiResult | null
    if (!res.ok) return { error: json?.error ?? `HTTP ${res.status}` }
    return json ?? { error: 'empty response' }
  } catch (error: unknown) {
    return { error }
  }
}
