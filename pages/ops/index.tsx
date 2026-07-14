// MuMate Ops Dashboard Phase 1 (#mumate-ops-dashboard-phase1). Single page, single scroll — no
// side-menu/nested nav (locked in FROZEN v3). getServerSideProps is the real gate: middleware
// only checks the cookie at the edge and lets `/ops` through either way (see middleware.ts
// guardOps) so this page can render the passkey form itself when unauthenticated.
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dashboardUsers } from '@/lib/db/schema'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { fetchSystemHealth, overallHealth, type ServiceHealth } from '@/lib/ops/health'
import { fetchBusinessMetrics, type BusinessMetrics } from '@/lib/ops/metrics'
import { fetchTeamActivity, type TeamActivity } from '@/lib/ops/activity'
import { GateForm } from '@/components/ops/GateForm'
import { HeroStrip } from '@/components/ops/HeroStrip'
import { HealthCard } from '@/components/ops/HealthCard'
import { MetricCard } from '@/components/ops/MetricCard'
import { ActivityList } from '@/components/ops/ActivityList'

type GateProps = { authenticated: false; users: Array<{ id: string; name: string }>; gateError: string | null }
type DashboardProps = {
  authenticated: true
  health: { fe: ServiceHealth; be: ServiceHealth }
  metrics: BusinessMetrics
  activity: TeamActivity
}
type Props = GateProps | DashboardProps

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')

  if (!isOpsAuthenticated(ctx.req)) {
    const users = await db
      .select({ id: dashboardUsers.id, name: dashboardUsers.name })
      .from(dashboardUsers)
      .where(eq(dashboardUsers.isActive, true))
      .orderBy(dashboardUsers.name)

    const gateError = typeof ctx.query.gate_error === 'string' ? ctx.query.gate_error : null
    return { props: { authenticated: false, users, gateError } }
  }

  const [health, metrics, activity] = await Promise.all([
    fetchSystemHealth(),
    fetchBusinessMetrics(),
    fetchTeamActivity(),
  ])

  return { props: { authenticated: true, health, metrics, activity } }
}

export default function OpsPage(props: Props) {
  if (!props.authenticated) {
    return (
      <>
        <Head>
          <title>Ops Dashboard — MuMate</title>
        </Head>
        <GateForm users={props.users} error={props.gateError} />
      </>
    )
  }

  const { health, metrics, activity } = props
  const overall = overallHealth([health.fe.status, health.be.status, activity.status])

  return (
    <>
      <Head>
        <title>Ops Dashboard — MuMate</title>
      </Head>
      <main className="min-h-screen bg-ops_bg p-4 font-ibm text-ops_text sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="sr-only">MuMate Ops Dashboard</h1>
        <HeroStrip overall={overall} />

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ops_text_muted">System Health</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <HealthCard service={health.fe} />
            <HealthCard service={health.be} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ops_text_muted">Business Metrics — {metrics.rangeLabel}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="ขอดูดวง" value={metrics.calculate.count} delta={metrics.calculate.delta} unit="ครั้ง" />
            <MetricCard title="Survey" value={metrics.survey.count} delta={metrics.survey.delta} unit="ครั้ง" />
            <MetricCard
              title="แต้ม"
              value={metrics.activityPoints.points}
              delta={metrics.activityPoints.deltaPoints}
              unit="พอยต์"
            />
            <MetricCard
              title="Revenue"
              value={metrics.revenue.amount}
              delta={metrics.revenue.deltaAmount}
              unit="บาท"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ops_text_muted">Team Activity</h2>
          <ActivityList activity={activity} />
        </section>
      </div>
      </main>
    </>
  )
}
