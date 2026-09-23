import type { NextApiRequest, NextApiResponse } from 'next'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import {
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
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  const requestedReferCode = req.body?.refer_code
  if (requestedReferCode !== undefined && typeof requestedReferCode !== 'string') {
    return res.status(400).json({ ok: false, error: 'refer_code must be a string' })
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
      return res.status(error.status).json({ ok: false, error: error.message })
    }
    console.error('[register-login-fe] failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ ok: false, error: 'register/login failed' })
  }
}
