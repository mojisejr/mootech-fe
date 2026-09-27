// mumate-vercel-to-do-001 slice 2, step 7 — vercel.json is the one source of the cron schedules.
// The image carries it, so the DigitalOcean host's timers (slice 3) read the schedules from the image they call,
// and every scheduled path must be a real route with a schedule shape the host can translate.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { crons?: { path: string; schedule: string }[] }
const crons = cfg.crons ?? []

describe('vercel.json crons', () => {
  it('exist', () => {
    expect(crons.length).toBeGreaterThan(0)
  })

  it.each(crons)('$path is a real API route', ({ path }) => {
    expect(existsSync(join(root, 'pages', `${path}.ts`))).toBe(true)
  })

  it.each(crons)('$schedule is a shape a systemd timer can mirror exactly (every minute or every N minutes)', ({ schedule }) => {
    expect(schedule === '* * * * *' || /^\*\/(\d+) \* \* \* \*$/.test(schedule)).toBe(true)
  })

  it('the runtime image carries vercel.json, and .dockerignore does not drop it', () => {
    const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8')
    const runner = dockerfile.slice(dockerfile.lastIndexOf('AS runner'))
    expect(runner).toMatch(/^COPY --from=builder [^\n]*\/app\/vercel\.json \.\/vercel\.json$/m)
    const ignore = existsSync(join(root, '.dockerignore')) ? readFileSync(join(root, '.dockerignore'), 'utf8') : ''
    expect(ignore.split('\n').map((l) => l.trim())).not.toContain('vercel.json')
  })
})
