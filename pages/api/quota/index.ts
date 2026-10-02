// Retired — answers 410 (mumate-member-identity-hardening-001 slice 1, 2026-10-02).
//
// This route took the member from a client-supplied user_id with no identity check. Its only caller was
// nothing (v2 reads /api/v2/quota since #358), behind a v1 page that middleware redirects (lib/v1-retired-routes.ts), so nothing live calls
// it and it is retired rather than fixed. The previous implementation is in git history for this path.
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({ error: 'gone' })
}
