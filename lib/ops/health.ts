// System Health data source (#mumate-ops-dashboard-phase1 Step 2). Server-side only — reads
// VERCEL_TOKEN, never sent to the client. Fetched once per SSR visit (no cache in Phase 1, per FROZEN v3).
//
// CIEL mumate-be-retirement-001 slice 2c: mootech-be's Render card is gone. The app no longer calls the BE
// (slice 2b), so a Render deploy that is down, suspended or deleted says nothing about whether MuMate works,
// and folding it into /ops overall health would paint the dashboard red for a service we are switching off
// on purpose (plan R7: suspend, then delete). RENDER_API_KEY left the code and .env.example with it.
export type HealthStatus = 'ok' | 'warn' | 'bad' | 'unknown'

export type ServiceHealth = {
  name: string
  status: HealthStatus
  detail: string
  deployedAt: string | null
  inspectUrl: string | null
}

// mootech-fe's own Vercel project (from .vercel/project.json).
const VERCEL_MOOTECH_FE_PROJECT_ID = 'prj_hpVveIvjLtlaXGqxAkOmROpVB4wZ'
const VERCEL_TEAM_ID = 'team_PFECFGw4REYizJFHPCHjFLUg'

function vercelReadyStateToHealth(state: string | undefined): HealthStatus {
  if (!state) return 'unknown'
  if (state === 'READY') return 'ok'
  if (['QUEUED', 'INITIALIZING', 'BUILDING'].includes(state)) return 'warn'
  return 'bad'
}

export async function fetchVercelHealth(): Promise<ServiceHealth> {
  const token = process.env.VERCEL_TOKEN
  if (!token) {
    return { name: 'mootech-fe', status: 'unknown', detail: 'VERCEL_TOKEN not configured', deployedAt: null, inspectUrl: null }
  }
  try {
    const url = `https://api.vercel.com/v7/deployments?projectId=${VERCEL_MOOTECH_FE_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}&target=production&limit=1`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!res.ok) {
      return { name: 'mootech-fe', status: 'bad', detail: `Vercel API ${res.status}`, deployedAt: null, inspectUrl: null }
    }
    const body = (await res.json()) as { deployments?: Array<{ readyState?: string; created?: number; inspectorUrl?: string | null }> }
    const latest = body.deployments?.[0]
    return {
      name: 'mootech-fe',
      status: vercelReadyStateToHealth(latest?.readyState),
      detail: latest?.readyState ?? 'no deployments found',
      deployedAt: latest?.created ? new Date(latest.created).toISOString() : null,
      inspectUrl: latest?.inspectorUrl ?? null,
    }
  } catch (e: any) {
    return { name: 'mootech-fe', status: 'bad', detail: e?.message ?? 'Vercel fetch failed', deployedAt: null, inspectUrl: null }
  }
}

export async function fetchSystemHealth(): Promise<{ fe: ServiceHealth }> {
  return { fe: await fetchVercelHealth() }
}

export function overallHealth(services: HealthStatus[]): HealthStatus {
  if (services.includes('bad')) return 'bad'
  if (services.includes('warn')) return 'warn'
  if (services.includes('unknown')) return 'unknown'
  return 'ok'
}
