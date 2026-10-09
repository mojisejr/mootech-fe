// @vitest-environment node
// scripts/og-asset-origin.test.ts — lib/og/asset-origin.ts and its use in pages/api/og/share.tsx.
// 2026-10-09: behind Caddy, Next gave the share-image edge route req.url = https://0.0.0.0:3000/…, the route fetched its
// background from there (TLS to a plain-HTTP port), and every LINE link preview timed out with no image.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { assetOrigin } from '@/lib/og/asset-origin'

describe('assetOrigin', () => {
  it('turns the https listen address Next builds behind a TLS proxy into plain http on loopback', () => {
    expect(assetOrigin('https://0.0.0.0:3000/api/og/share?t=x')).toBe('http://127.0.0.1:3000')
  })
  it('keeps the port for every local spelling', () => {
    expect(assetOrigin('http://0.0.0.0:3000/api/og/share')).toBe('http://127.0.0.1:3000')
    expect(assetOrigin('https://localhost:3100/x')).toBe('http://127.0.0.1:3100')
    expect(assetOrigin('http://[::1]:3000/x')).toBe('http://127.0.0.1:3000')
  })
  it('leaves a real host alone (Vercel, or a trusted Host header)', () => {
    expect(assetOrigin('https://bazichart.mumate.co/api/og/share?t=x')).toBe('https://bazichart.mumate.co')
    expect(assetOrigin('https://app.staging.mumate.co/api/og/share')).toBe('https://app.staging.mumate.co')
  })
})

describe('pages/api/og/share.tsx', () => {
  const source = readFileSync(path.join(process.cwd(), 'pages/api/og/share.tsx'), 'utf8')
  it('builds image URLs from assetOrigin, not from req.url\'s own origin', () => {
    expect(source).toMatch(/const origin = assetOrigin\(req\.url\)/)
    expect(source).not.toMatch(/\{[^}]*\borigin\b[^}]*\} = new URL\(req\.url\)/)
  })
})
