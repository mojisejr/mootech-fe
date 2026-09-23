import type { NextApiRequest, NextApiResponse } from 'next'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import {
  normalizeIncomingReferCode,
  RegisterLoginError,
  registerOrLoginInFe,
  type RegisterLoginInput,
} from '@/lib/auth/register-login-fe'
import { postgresRegisterLoginStore } from '@/lib/auth/register-login-fe-store'

type SessionIdentity = Session & {
  provider?: string
  providerId?: string
  lineProfile?: { sub?: string }
}

export function inputFromVerifiedSession(
  session: SessionIdentity | null,
  referCode = '',
): RegisterLoginInput | null {
  const provider = (session?.provider ?? '').trim()
  const providerId = (session?.providerId ?? '').trim()
  if (!session?.user || !provider || !providerId) return null

  const lineSubject = (session.lineProfile?.sub ?? '').trim()
  if (provider.toUpperCase() === 'LINE' && lineSubject && lineSubject !== providerId) return null

  return {
    provider,
    providerSubject: providerId,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    pictureUrl: session.user.image ?? '',
    referCode,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // `ok: false` is the sign-out flag, reserved below for a refused identity.
  // Transport and caller-shape failures answer without it so nobody is logged
  // out over them.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const requestedReferCode = req.body?.refer_code
  if (requestedReferCode !== undefined && typeof requestedReferCode !== 'string') {
    return res.status(400).json({ error: 'refer_code must be a string' })
  }

  if (normalizeIncomingReferCode(requestedReferCode)) {
    // Observability only. Referral writes stay on the legacy route; this one
    // ignores the code rather than refusing the login over it.
    console.warn('[register-login-fe] referral code ignored; referral writes are not on this route')
  }

  // Identity is derived only from the signed, httpOnly NextAuth session. Body
  // fields named user_id/provider/idToken are intentionally ignored.
  const session = (await getServerSession(req, res, authOptions)) as SessionIdentity | null
  const input = inputFromVerifiedSession(session, requestedReferCode)
  if (!input) return res.status(401).json({ ok: false, error: 'not signed in' })

  try {
    return res.status(200).json(await registerOrLoginInFe(postgresRegisterLoginStore, input))
  } catch (error) {
    if (error instanceof RegisterLoginError) {
      // Only a refused identity carries the flag. An ambiguous or orphaned
      // mapping (409) needs manual recovery, and signing the member out neither
      // fixes it nor preserves the session support will need.
      return res.status(error.status).json(
        error.identityRejected
          ? { ok: false, error: error.message }
          : { error: error.message },
      )
    }
    console.error('[register-login-fe] failed', error instanceof Error ? error.message : 'unknown error')
    // A server fault is retryable. Both callers treat a body with neither `ok:
    // false` nor `user_id` as "do not wipe, let a later render retry".
    return res.status(500).json({ error: 'register/login failed' })
  }
}
