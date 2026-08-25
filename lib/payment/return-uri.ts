// Where Omise sends the customer back after 3-D Secure (mootech-fe#439).
//
// 🔴 WHY THIS FILE EXISTS AT ALL. On 2026-08-25 a real card was refused with
//     failure_message: "3d secure is requested but return_uri is not set"
// The account has 3DS switched on, so Omise wants to send the cardholder to their bank — and refuses the
// whole charge when we have not said where to send them back to. The card was fine (4242…, the docs' own
// "successful" test card): it was never judged, because enrollment failed first.
//
// 🔴 PER CHARGE, NOT A CONSTANT. A single env value cannot be the answer: the customer must come back to
// the result screen for THEIR order, not to a generic page. So the env holds the ORIGIN only and this
// module builds the rest — the same split lib/payment/webhook-endpoint.ts uses for the webhook URL.
//
// 🔴 IT CARRIES OUR OWN orderId, AND NOTHING OMISE APPENDS IS TRUSTED. We do not know what query Omise
// adds on the way back (docs.omise.co returned 404 for every deeper page checked on 2026-08-25), and it
// would not matter if we did: a redirect is a URL, and "a URL is a thing anyone can type" (#363). The
// screen still asks /api/v2/payment/status and lets the SERVER decide whether money moved. The orderId is
// only how the screen finds its own row — it is never evidence of anything.
//
// 🔴 CARD ONLY. PromptPay keeps the old OMISE_RETURN_URI (unset on prod, verified 2026-08-25) so this
// ticket cannot move a lane it was not asked to touch — ฟีม เคาะทาง B.
import { hostnameIsRejected } from './webhook-endpoint'

export const CARD_RETURN_ORIGIN_ENV = 'OMISE_RETURN_ORIGIN_V2'

export class ReturnUriConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReturnUriConfigError'
  }
}

/**
 * The origin the customer is returned to, validated. Throws rather than falling back — a bad origin must
 * fail before a card is charged, never after.
 *
 * Returns null when the env is simply UNSET. That is not an error: it is the pre-#439 behaviour (no
 * return_uri is sent at all), which is exactly what makes it safe to deploy this code before the env
 * exists. Only a PRESENT-BUT-BROKEN value throws.
 */
export function cardReturnOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[CARD_RETURN_ORIGIN_ENV]
  if (!raw || raw.trim() === '') return null
  const value = raw.trim()
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ReturnUriConfigError(`${CARD_RETURN_ORIGIN_ENV} is not a valid URL`)
  }
  if (url.protocol !== 'https:') {
    throw new ReturnUriConfigError(`${CARD_RETURN_ORIGIN_ENV} must be https — a bank will not redirect to http`)
  }
  if (hostnameIsRejected(url.hostname)) {
    throw new ReturnUriConfigError(
      `${CARD_RETURN_ORIGIN_ENV} host ${url.hostname} is unusable (localhost or an IP) — the bank redirects the ` +
        `CUSTOMER'S browser, which is not on this machine`,
    )
  }
  return url.origin
}

/**
 * The full return URL for one card charge, or null when the env is unset.
 *
 * `state=PAYING` because that is what the result screen expects to be told on arrival, and `package_code`
 * so "เลือกวิธีชำระเงินอื่น" can lead back to the right checkout (#438) if the bank declines.
 */
export function cardReturnUri(
  args: { orderId: string; packageCode: string },
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const origin = cardReturnOrigin(env)
  if (!origin) return null
  const u = new URL('/v2/shop/result', origin)
  u.searchParams.set('state', 'PAYING')
  u.searchParams.set('order', args.orderId)
  if (args.packageCode) u.searchParams.set('package_code', args.packageCode)
  return u.toString()
}

/**
 * The form fields to merge into a create-charge POST for a CARD.
 *
 * 🔑 Fields rather than applied inside the adapter, for the same two reasons webhookEndpointFields gives:
 * a test can assert on the value, and the PromptPay path provably does NOT go through here.
 */
export function cardReturnUriFields(
  args: { orderId: string; packageCode: string },
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const uri = cardReturnUri(args, env)
  return uri ? { return_uri: uri } : {}
}
