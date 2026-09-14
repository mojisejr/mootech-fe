// Beam Checkout lane slice 1 — the gateway SELECTOR (lib/payment/select-gateway.ts): one variable decides
// which adapter charges, and the contract is that "unset" is Omise, byte for byte, because Omise is LIVE
// and is the rollback for the Beam flip.
//
// 🔴 MUTANT CONTRACT (each reddens this spec):
//   MR1  unset/empty resolves to anything but 'omise'          → the default cases fail
//   MR2  an unknown name falls back instead of throwing        → the typo case fails (money through a
//                                                                provider nobody chose)
//   MR3  gatewayFor('omise') stops returning the Omise adapter → the identity case fails
//   MR4  'beam' resolves to anything but the Beam adapter      → the beam case fails
import { describe, it, expect, afterEach } from 'vitest'
import {
  gatewayNameFrom,
  gatewayNameFromEnv,
  gatewayFor,
  selectGateway,
  webhookCodecFor,
  UnknownGatewayError,
  GatewayNotInstalledError,
  DEFAULT_GATEWAY,
} from '../lib/payment/select-gateway'
import { omiseGateway } from '../lib/payment/omise-gateway'
import { beamGateway, beamWebhookCodec } from '../lib/payment/beam-gateway'

const saved = process.env.PAYMENT_GATEWAY
afterEach(() => {
  if (saved === undefined) delete process.env.PAYMENT_GATEWAY
  else process.env.PAYMENT_GATEWAY = saved
})

describe('gatewayNameFrom — the pure rule', () => {
  it('unset, empty and whitespace all mean Omise (the live gateway, the rollback)', () => {
    expect(DEFAULT_GATEWAY).toBe('omise')
    expect(gatewayNameFrom(undefined)).toBe('omise')
    expect(gatewayNameFrom(null)).toBe('omise')
    expect(gatewayNameFrom('')).toBe('omise')
    expect(gatewayNameFrom('   ')).toBe('omise')
  })

  it('accepts the two known names, trimmed and case-insensitive', () => {
    expect(gatewayNameFrom('omise')).toBe('omise')
    expect(gatewayNameFrom(' Omise ')).toBe('omise')
    expect(gatewayNameFrom('beam')).toBe('beam')
    expect(gatewayNameFrom('BEAM')).toBe('beam')
  })

  it('🔴 a name it does not know THROWS, spelling the value back — never a silent fallback', () => {
    expect(() => gatewayNameFrom('beem')).toThrow(UnknownGatewayError)
    expect(() => gatewayNameFrom('beem')).toThrow(/"beem"/)
    expect(() => gatewayNameFrom('stripe')).toThrow(/omise \| beam/)
  })
})

describe('gatewayNameFromEnv / selectGateway — read at call time', () => {
  it('PAYMENT_GATEWAY unset ⇒ the Omise adapter, the very same object the routes used to import', () => {
    delete process.env.PAYMENT_GATEWAY
    expect(gatewayNameFromEnv()).toBe('omise')
    expect(selectGateway()).toBe(omiseGateway)
  })

  it('PAYMENT_GATEWAY=omise ⇒ identical', () => {
    process.env.PAYMENT_GATEWAY = 'omise'
    expect(selectGateway()).toBe(omiseGateway)
  })

  it('a later change to the variable is seen by the next call (no import-time capture)', () => {
    delete process.env.PAYMENT_GATEWAY
    expect(gatewayNameFromEnv()).toBe('omise')
    process.env.PAYMENT_GATEWAY = 'beam'
    expect(gatewayNameFromEnv()).toBe('beam')
  })

  it('🔴 a typo in the variable throws on the first charge instead of charging through Omise', () => {
    process.env.PAYMENT_GATEWAY = 'beem'
    expect(() => selectGateway()).toThrow(UnknownGatewayError)
  })
})

describe('gatewayFor / webhookCodecFor — by NAME, for the reconciler and the webhook routes', () => {
  it("gatewayFor('omise') is the Omise adapter", () => {
    expect(gatewayFor('omise')).toBe(omiseGateway)
  })

  it("webhookCodecFor('omise') verifies with the Omise headers and parses the Omise event shape", () => {
    const codec = webhookCodecFor('omise')
    // No secret configured in this process ⇒ Omise verify fails closed; the point here is the wiring.
    expect(codec.verify(Buffer.from('{}'), () => null)).toBe(false)
    const evt = codec.parse(
      Buffer.from(JSON.stringify({ key: 'charge.complete', data: { id: 'chrg_x', paid: true, status: 'successful', metadata: { orderId: '1' } } })),
      () => null,
    )
    expect(evt).toMatchObject({ key: 'charge.complete', chargeId: 'chrg_x', paid: true, status: 'successful', orderId: '1' })
  })

  it("'beam' resolves to the Beam adapter and the Beam webhook codec (installed in slice 2)", () => {
    expect(gatewayFor('beam')).toBe(beamGateway)
    expect(webhookCodecFor('beam')).toBe(beamWebhookCodec)
    process.env.PAYMENT_GATEWAY = 'beam'
    expect(selectGateway()).toBe(beamGateway)
  })

  it('GatewayNotInstalledError still exists for a future name whose adapter a build lacks', () => {
    expect(new GatewayNotInstalledError('beam').message).toMatch(/not installed/)
  })
})
