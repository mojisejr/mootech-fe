// Deterministic tests for the What If temporary gate + proxy.
// Run: bun scripts/what-if-infra.test.ts
import assert from 'node:assert/strict'

import { NextRequest } from 'next/server'
import { middleware } from '../middleware'
import handler, { config, sanitizeWhatIfBody } from '../pages/api/what-if/generate'

let pass = 0
async function t(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

function resetEnv() {
  delete process.env.WHATIF_KEY
  delete process.env.MAINTENANCE_MODE
  delete process.env.MAINTENANCE_BYPASS_KEY
  delete process.env.GLASS_BOX_KEY
  delete process.env.BAZI_WHATIF_URL
}

function mkReq(path: string, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  return new NextRequest(new URL('http://localhost' + path), { headers })
}

const rewriteTarget = (res: any): string | null => res.headers.get('x-middleware-rewrite')
const locationTarget = (res: any): string | null => res.headers.get('location')
const isPassThrough = (res: any): boolean =>
  rewriteTarget(res) == null && locationTarget(res) == null
const isRewrittenToMaintenance = (res: any): boolean =>
  (rewriteTarget(res) || '').includes('/maintenance')

function createJsonRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  return res
}

async function main() {
  await t('What If gate fails closed when WHATIF_KEY is unset', () => {
    resetEnv()
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/what-if'))), true)
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/api/what-if/generate'))), true)
  })

  await t('What If gate accepts ?key, sets httpOnly cookie, and redirects to clean URL', () => {
    resetEnv()
    process.env.WHATIF_KEY = 'test-secret'
    const res = middleware(mkReq('/what-if?key=test-secret&keep=1'))
    assert.equal(locationTarget(res), 'http://localhost/what-if?keep=1')
    const setCookie = res.headers.get('set-cookie') || ''
    assert.match(setCookie, /whatif_access=test-secret/)
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /Max-Age=86400/)
  })

  await t('What If gate passes with valid cookie and denies wrong cookie', () => {
    resetEnv()
    process.env.WHATIF_KEY = 'test-secret'
    assert.equal(isPassThrough(middleware(mkReq('/what-if', 'whatif_access=test-secret'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/api/what-if/generate', 'whatif_access=test-secret'))), true)
    assert.equal(isRewrittenToMaintenance(middleware(mkReq('/what-if', 'whatif_access=nope'))), true)
  })

  await t('first-visit redirect fires only for gated testers who have not played', () => {
    resetEnv()
    process.env.WHATIF_KEY = 'test-secret'
    assert.equal(locationTarget(middleware(mkReq('/', 'whatif_access=test-secret'))), 'http://localhost/what-if')
    assert.equal(isPassThrough(middleware(mkReq('/', 'whatif_access=test-secret; whatif_played=1'))), true)
    assert.equal(isPassThrough(middleware(mkReq('/'))), true)
  })

  await t('proxy config allows the slow Imagen path', () => {
    assert.equal(config.maxDuration, 60)
  })

  await t('proxy body whitelist strips client-controlled model/provider/apiKey', () => {
    assert.deepEqual(
      sanitizeWhatIfBody({
        birthDate: '2535-01-01',
        birthTime: '09:30',
        gender: 'female',
        currentJob: 'designer',
        withImage: false,
        apiKey: 'client-secret',
        model: 'expensive-model',
        provider: 'other',
      }),
      {
        birthDate: '2535-01-01',
        birthTime: '09:30',
        gender: 'female',
        currentJob: 'designer',
        withImage: false,
      },
    )
  })

  await t('proxy forwards only whitelisted JSON and passthrough status/body', async () => {
    resetEnv()
    process.env.BAZI_WHATIF_URL = 'https://bazi.example.test/api/what-if/generate'
    const originalFetch = globalThis.fetch
    let capturedUrl = ''
    let capturedBody: any = null
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url)
      capturedBody = JSON.parse(String(init?.body || '{}'))
      return new Response(JSON.stringify({ ok: true, answer: 'parallel' }), { status: 207 })
    }) as typeof fetch

    try {
      const res = createJsonRes()
      await handler(
        {
          method: 'POST',
          body: {
            birthDate: '2535-01-01',
            birthTime: '09:30',
            gender: 'female',
            currentJob: 'designer',
            withImage: false,
            apiKey: 'strip-me',
            model: 'strip-me',
            provider: 'strip-me',
          },
        } as any,
        res as any,
      )

      assert.equal(capturedUrl, 'https://bazi.example.test/api/what-if/generate')
      assert.deepEqual(capturedBody, {
        birthDate: '2535-01-01',
        birthTime: '09:30',
        gender: 'female',
        currentJob: 'designer',
        withImage: false,
      })
      assert.equal(res.statusCode, 207)
      assert.deepEqual(res.body, { ok: true, answer: 'parallel' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  await t('proxy error shape matches bazi-style {error:{message}}', async () => {
    resetEnv()
    const res = createJsonRes()
    await handler({ method: 'GET', body: {} } as any, res as any)
    assert.equal(res.statusCode, 405)
    assert.deepEqual(res.body, { error: { message: 'Method not allowed' } })
  })

  if (process.exitCode) {
    console.error(`\nwhat-if-infra: FAILED (${pass} passed)`)
  } else {
    console.log(`what-if-infra: all ${pass} passed ✓`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
