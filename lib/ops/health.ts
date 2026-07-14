// System Health data source (#mumate-ops-dashboard-phase1 Step 2). Server-side only — reads
// RENDER_API_KEY / VERCEL_TOKEN, never sent to the client. Fetched once per SSR visit (no cache
// in Phase 1, per FROZEN v3).
export type HealthStatus = 'ok' | 'warn' | 'bad' | 'unknown'

export type ServiceHealth = {
  name: string
  status: HealthStatus
  detail: string
  deployedAt: string | null
  inspectUrl: string | null
}

// mootech-be on Render (verified via Render MCP against the live account, 2026-07-14).
const RENDER_MOOTECH_BE_SERVICE_ID = 'srv-d8nc4j8k1i2s73d7e030'

// mootech-fe's own Vercel project (from .vercel/project.json).
const VERCEL_MOOTECH_FE_PROJECT_ID = 'prj_hpVveIvjLtlaXGqxAkOmROpVB4wZ'
const VERCEL_TEAM_ID = 'team_PFECFGw4REYizJFHPCHjFLUg'

function renderDeployStatusToHealth(status: string | undefined): HealthStatus {
  if (!status) return 'unknown'
  if (status === 'live') return 'ok'
  if (['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress'].includes(status)) {
    return 'warn'
  }
  return 'bad'
}

function vercelReadyStateToHealth(state: string | undefined): HealthStatus {
  if (!state) return 'unknown'
  if (state === 'READY') return 'ok'
  if (['QUEUED', 'INITIALIZING', 'BUILDING'].includes(state)) return 'warn'
  return 'bad'
}

export async function fetchRenderHealth(): Promise<ServiceHealth> {
  const key = process.env.RENDER_API_KEY
  if (!key) {
    return { name: 'mootech-be', status: 'unknown', detail: 'RENDER_API_KEY not configured', deployedAt: null, inspectUrl: null }
  }
  try {
    const res = await fetch(
      `https://api.render.com/v1/services/${RENDER_MOOTECH_BE_SERVICE_ID}/deploys?limit=1`,
      { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } },
    )
    if (!res.ok) {
      return { name: 'mootech-be', status: 'bad', detail: `Render API ${res.status}`, deployedAt: null, inspectUrl: null }
    }
    // Render's REST API wraps each item as {deploy: {...}, cursor}; unwrap defensively since we
    // could not test this against a live RENDER_API_KEY (blocked — see ack:mumate-ops-dashboard).
    const body = (await res.json()) as Array<
      { deploy?: { status?: string; finishedAt?: string; createdAt?: string } } & { status?: string; finishedAt?: string; createdAt?: string }
    >
    const latest = body[0]?.deploy ?? body[0]
    return {
      name: 'mootech-be',
      status: renderDeployStatusToHealth(latest?.status),
      detail: latest?.status ?? 'no deploys found',
      deployedAt: latest?.finishedAt ?? latest?.createdAt ?? null,
      inspectUrl: `https://dashboard.render.com/web/${RENDER_MOOTECH_BE_SERVICE_ID}`,
    }
  } catch (e: any) {
    return { name: 'mootech-be', status: 'bad', detail: e?.message ?? 'Render fetch failed', deployedAt: null, inspectUrl: null }
  }
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

export async function fetchSystemHealth(): Promise<{ fe: ServiceHealth; be: ServiceHealth }> {
  const [be, fe] = await Promise.all([fetchRenderHealth(), fetchVercelHealth()])
  return { fe, be }
}

export function overallHealth(services: HealthStatus[]): HealthStatus {
  if (services.includes('bad')) return 'bad'
  if (services.includes('warn')) return 'warn'
  if (services.includes('unknown')) return 'unknown'
  return 'ok'
}
