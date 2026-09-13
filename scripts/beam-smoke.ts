// Beam lane slice 2 — the ARENA RUN, as a command instead of a rediscovery. Drives Beam Playground end to
// end from a laptop with the local stack up (testenv/README.md) and a cloudflared quick tunnel pointed at
// :3000, so the Playground webhook can reach /api/v2/payment/webhook-beam. No test framework: it prints
// what it did and exits non-zero on the first surprise. NOTHING here touches production: it refuses to run
// unless BEAM_API_BASE names the playground host.
//
//   1. bash testenv/scripts/stack.sh up · boot fe (:3000) + bazi (:3100)
//   2. cloudflared tunnel --url http://localhost:3000   → https://xxxx.trycloudflare.com
//   3. Playground Lighthouse → Webhook → https://xxxx.trycloudflare.com/api/v2/payment/webhook-beam
//      events: charge.succeeded charge.failed refund.succeeded refund.failed payment_link.paid
//   4. in <repo>/.env (the LOCAL one stack.sh swapped in — never testenv/env/*):
//        PAYMENT_GATEWAY=beam  BEAM_API_BASE=https://playground.api.beamcheckout.com
//        BEAM_MERCHANT_ID=…  BEAM_API_KEY=…  BEAM_WEBHOOK_HMAC_KEY=…
//   5. npx tsx --env-file=.env scripts/beam-smoke.ts create        → prints chargeId, writes the QR PNG
//      open the PNG (or the Force-Charge page Beam shows for Playground QR) → "Mark as Succeeded"
//      npx tsx --env-file=.env scripts/beam-smoke.ts status <chargeId>   → SUCCEEDED once you did
//      npx tsx --env-file=.env scripts/beam-smoke.ts refund <chargeId>   → refund.succeeded webhook follows
//   6. check the row: select status, gateway, failure_code from v2_payment where charge_id = '<chargeId>';
//      (this script creates a Beam charge DIRECTLY, without a v2_payment row — to exercise the row too,
//       buy through the UI on the tunnel URL instead; the webhook then settles a real row.)
import { writeFileSync } from 'node:fs'
import { beamGateway, beamApiBase, BEAM_PLAYGROUND_API } from '../lib/payment/beam-gateway'

async function beam(path: string, init: RequestInit = {}) {
  const auth = 'Basic ' + Buffer.from(`${process.env.BEAM_MERCHANT_ID}:${process.env.BEAM_API_KEY}`).toString('base64')
  const res = await fetch(`${beamApiBase()}${path}`, {
    ...init,
    headers: { Authorization: auth, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, requestId: res.headers.get('x-beam-request-id'), json }
}

function guard() {
  if (beamApiBase() !== BEAM_PLAYGROUND_API) {
    console.error(`refusing: BEAM_API_BASE is ${beamApiBase()} — this script runs against Playground only`)
    process.exit(2)
  }
  for (const k of ['BEAM_MERCHANT_ID', 'BEAM_API_KEY']) {
    if (!process.env[k]) {
      console.error(`refusing: ${k} is not set (put the Playground value in the local .env, never in the repo)`)
      process.exit(2)
    }
  }
}

async function main() {
  guard()
  const [cmd, arg] = process.argv.slice(2)
  if (cmd === 'create') {
    const orderId = `smoke${Date.now()}`.slice(0, 10)
    const r = await beamGateway.createPromptPayCharge({ amountSatang: 100, email: 'smoke@example.com', orderId })
    const png = r.qrDownloadUri?.replace(/^data:image\/png;base64,/, '')
    const file = `/tmp/beam-smoke-${r.chargeId}.png`
    if (png) writeFileSync(file, Buffer.from(png, 'base64'))
    console.log(JSON.stringify({ chargeId: r.chargeId, orderId, expiresAt: r.expiresAt, status: r.status, qrPng: png ? file : null }, null, 2))
    console.log('\nScan/open the QR (Playground shows a Force Charge page) → "Mark as Succeeded" → the webhook fires.')
    return
  }
  if (cmd === 'status' && arg) {
    const r = await beamGateway.retrieveCharge(arg)
    const raw = await beam(`/api/v1/charges/${encodeURIComponent(arg)}`)
    console.log(JSON.stringify({ port: r, beam: { status: raw.status, requestId: raw.requestId, body: raw.json } }, null, 2))
    return
  }
  if (cmd === 'refund' && arg) {
    const r = await beam('/api/v1/refunds', { method: 'POST', body: JSON.stringify({ chargeId: arg, reason: 'beam-smoke full refund' }), headers: { 'x-beam-idempotency-key': `refund:${arg}` } })
    console.log(JSON.stringify(r, null, 2))
    return
  }
  console.error('usage: beam-smoke.ts create | status <chargeId> | refund <chargeId>')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
