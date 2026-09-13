// The SEAM the port always promised and never had (gateway.ts:1-3 says "the route code never imports the
// adapter directly" — four files did). One place turns a NAME into a PaymentGateway, and the name comes
// from ONE variable, so switching providers — or rolling back — is an env change and a redeploy, not a
// code change. Beam Checkout lane, CIEL workstream mootech-fe-beam-gateway-001 slice 1.
//
// 🔴 THE CONTRACT THIS FILE KEEPS: `PAYMENT_GATEWAY` unset, empty, or 'omise' ⇒ exactly what production
// does today, byte for byte. Omise is LIVE and is the rollback for the Beam flip; nothing here may make
// that path depend on Beam code existing, loading, or being configured.
//
// 🔴 AN UNKNOWN NAME FAILS LOUD, NOT SAFE. A typo ('beem') must not quietly charge through Omise: the
// operator asked for something else, and the honest answer to "which gateway?" is "I do not know that
// one" — at request time, on the first charge, with the value spelled back. Silently falling back would
// move real money through a provider nobody chose, and the log line would be the only witness.
import type { Buffer } from 'node:buffer'
import type { ChargeEvent, PaymentGateway } from './gateway'
import { parseChargeEvent } from './gateway'
import { omiseGateway } from './omise-gateway'
import { beamGateway, beamWebhookCodec } from './beam-gateway'

export const GATEWAY_NAMES = ['omise', 'beam'] as const
export type GatewayName = (typeof GATEWAY_NAMES)[number]
export const DEFAULT_GATEWAY: GatewayName = 'omise'

export class UnknownGatewayError extends Error {
  constructor(public readonly value: string) {
    super(
      `PAYMENT_GATEWAY=${JSON.stringify(value)} is not a gateway this build knows (${GATEWAY_NAMES.join(' | ')}). ` +
        `Refusing to charge through a provider nobody chose — unset it (Omise) or spell it correctly.`,
    )
    this.name = 'UnknownGatewayError'
  }
}

export class GatewayNotInstalledError extends Error {
  constructor(public readonly gateway: GatewayName) {
    super(`payment gateway '${gateway}' is selected but its adapter is not installed in this build`)
    this.name = 'GatewayNotInstalledError'
  }
}

/** PURE: the name a raw env value means. Trims and lower-cases; unset/empty ⇒ the default (Omise). */
export function gatewayNameFrom(raw: string | undefined | null): GatewayName {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === '') return DEFAULT_GATEWAY
  if ((GATEWAY_NAMES as readonly string[]).includes(v)) return v as GatewayName
  throw new UnknownGatewayError(raw ?? '')
}

/** The gateway THIS process charges through. Read at call time (never at import), so a test or a
 *  redeploy that changes the variable is seen by the next request. */
export function gatewayNameFromEnv(): GatewayName {
  return gatewayNameFrom(process.env.PAYMENT_GATEWAY)
}

/**
 * The adapter for a NAME — what the reconciler needs, because each v2_payment row remembers the gateway
 * that created it (0027) and must be asked about at THAT provider, never at whichever one is current.
 *
 * GatewayNotInstalledError is kept for the general case (a name this file knows whose adapter a given
 * build does not carry): the reconciler treats a throw here as "unreachable" (the row is left alone),
 * and the charge routes surface it as a 500 — loud, on the first request, and only for an operator who
 * set the variable to a gateway this build does not carry. Since slice 2 both names resolve.
 */
export function gatewayFor(name: GatewayName): PaymentGateway {
  switch (name) {
    case 'omise':
      return omiseGateway
    case 'beam':
      return loadBeam()
  }
}

/** The adapter for THIS process's configured gateway — what the charge routes call. */
export function selectGateway(): PaymentGateway {
  return gatewayFor(gatewayNameFromEnv())
}

// Slice 2 installed the adapter. The static import is fine: beam-gateway.ts reads its env lazily (only
// when a Beam call is made), so an Omise-only deploy pays nothing for carrying it.
function loadBeam(): PaymentGateway {
  return beamGateway
}

/** A header lookup the webhook routes hand in, so the codec never touches the Next request itself. */
export type HeaderReader = (name: string) => string | null

/**
 * What a gateway's WEBHOOK ROUTE needs and the charge routes do not: verify the delivery against that
 * provider's signing scheme, then normalise its body into the ChargeEvent that webhook-dispatch.ts
 * judges. Header names and JSON shapes differ per provider; everything after `parse` is shared.
 */
export type WebhookCodec = {
  verify: (rawBody: Buffer, header: HeaderReader) => boolean
  parse: (rawBody: Buffer, header: HeaderReader) => ChargeEvent
}

export function webhookCodecFor(name: GatewayName): WebhookCodec {
  switch (name) {
    case 'omise':
      return {
        verify: (raw, h) => omiseGateway.verifyWebhook(raw, h('omise-signature'), h('omise-signature-timestamp')),
        parse: (raw) => parseChargeEvent(raw),
      }
    case 'beam':
      return loadBeamWebhook()
  }
}

function loadBeamWebhook(): WebhookCodec {
  return beamWebhookCodec
}
