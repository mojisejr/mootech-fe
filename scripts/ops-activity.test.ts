// Deterministic tests for the Team Activity GitHub REST integration
// (#mumate-ops-dashboard-phase1 Step 4). Mocks fetch — no real GitHub calls.
// Run: bun scripts/ops-activity.test.ts   or: npx tsx scripts/ops-activity.test.ts
import assert from 'node:assert/strict'
import { fetchTeamActivity } from '../lib/ops/activity'

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

function withMockFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

async function main() {
  await t('returns warn with empty items when GITHUB_TOKEN is unset', async () => {
    delete process.env.GITHUB_TOKEN
    const result = await fetchTeamActivity()
    assert.equal(result.status, 'warn')
    assert.deepEqual(result.items, [])
  })

  await t('maps a real-shape search/issues response into PR items, merged/open/closed correctly', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    await withMockFetch(
      (async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                number: 54,
                title: 'merged PR',
                html_url: 'https://github.com/mojisejr/mootech-fe/pull/54',
                state: 'closed',
                repository_url: 'https://api.github.com/repos/mojisejr/mootech-fe',
                updated_at: '2026-07-14T02:56:52Z',
                user: { login: 'mojisejr' },
                pull_request: { merged_at: '2026-07-14T02:55:34Z' },
              },
              {
                number: 10,
                title: 'open PR',
                html_url: 'https://github.com/mojisejr/mootech-be/pull/10',
                state: 'open',
                repository_url: 'https://api.github.com/repos/mojisejr/mootech-be',
                updated_at: '2026-07-13T00:00:00Z',
                user: { login: 'mojisejr' },
                pull_request: {},
              },
              {
                number: 9,
                title: 'closed unmerged PR',
                html_url: 'https://github.com/mojisejr/mootech-be/pull/9',
                state: 'closed',
                repository_url: 'https://api.github.com/repos/mojisejr/mootech-be',
                updated_at: '2026-07-12T00:00:00Z',
                user: { login: 'mojisejr' },
                pull_request: { merged_at: null },
              },
            ],
          }),
          { status: 200 },
        )) as typeof fetch,
      async () => {
        const result = await fetchTeamActivity()
        assert.equal(result.status, 'ok')
        assert.equal(result.items.length, 3)
        assert.deepEqual(
          result.items.map((i) => [i.repo, i.number, i.state]),
          [
            ['mootech-fe', 54, 'merged'],
            ['mootech-be', 10, 'open'],
            ['mootech-be', 9, 'closed'],
          ],
        )
      },
    )
  })

  await t('rate limit (403/429) returns warn, not bad — transient, not broken', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    await withMockFetch(
      (async () => new Response('{}', { status: 403 })) as typeof fetch,
      async () => {
        const result = await fetchTeamActivity()
        assert.equal(result.status, 'warn')
        assert.deepEqual(result.items, [])
      },
    )
  })

  await t('other non-ok status returns bad', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    await withMockFetch(
      (async () => new Response('{}', { status: 500 })) as typeof fetch,
      async () => {
        const result = await fetchTeamActivity()
        assert.equal(result.status, 'bad')
      },
    )
  })

  await t('network/timeout failure returns bad with a detail message, does not throw', async () => {
    process.env.GITHUB_TOKEN = 'test-token'
    await withMockFetch(
      (async () => {
        throw new Error('network unreachable')
      }) as typeof fetch,
      async () => {
        const result = await fetchTeamActivity()
        assert.equal(result.status, 'bad')
        assert.match(result.detail, /network unreachable/)
      },
    )
  })

  if (process.exitCode) {
    console.error(`\nops-activity: FAILED (${pass} passed)`)
  } else {
    console.log(`ops-activity: all ${pass} passed ✓`)
  }
}

main()
