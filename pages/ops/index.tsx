// MuMate Ops Dashboard (#mumate-ops-dashboard-phase1, #mumate-ops-dashboard-pr56). Single page,
// single scroll — no side-menu/nested nav. getServerSideProps is the real gate: middleware only
// checks the cookie at the edge and lets `/ops` through either way (see middleware.ts guardOps)
// so this page can render the passkey form itself when unauthenticated.
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dashboardUsers } from '@/lib/db/schema'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { fetchSystemHealth, overallHealth, type ServiceHealth } from '@/lib/ops/health'
import {
  fetchBusinessMetrics,
  fetchPointsBreakdown,
  fetchRevenueBreakdown,
  type BusinessMetrics,
  type PointsBreakdown,
  type RevenueBreakdownRow,
} from '@/lib/ops/metrics'
import { fetchAiQuota, type AiQuotaBreakdown } from '@/lib/ops/ai-usage'
import { fetchTeamActivity, type TeamActivity } from '@/lib/ops/activity'
import { fetchCalculatorUsage, type CalculatorUsage } from '@/lib/ops/calculator-usage'
import { GateForm } from '@/components/ops/GateForm'
import { HeroStrip } from '@/components/ops/HeroStrip'
import { HealthCard } from '@/components/ops/HealthCard'
import { MetricCard } from '@/components/ops/MetricCard'
import { QuotaCard } from '@/components/ops/QuotaCard'
import { BreakdownRow } from '@/components/ops/BreakdownRow'
import { SegmentedBar } from '@/components/ops/SegmentedBar'
import { ActivityList } from '@/components/ops/ActivityList'

type GateProps = { authenticated: false; users: Array<{ id: string; name: string }>; gateError: string | null }
type DashboardProps = {
  authenticated: true
  health: { fe: ServiceHealth; be: ServiceHealth }
  metrics: BusinessMetrics
  points: PointsBreakdown
  revenue: RevenueBreakdownRow[]
  aiQuota: AiQuotaBreakdown
  activity: TeamActivity
  calculatorUsage: CalculatorUsage
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

  // Sequential, not Promise.all: adding fetchCalculatorUsage as a 7th concurrent call
  // reproducibly hung this page indefinitely (verified live, 2026-07-15 — isolated to a plain
  // Node script: 7-way Promise.all never returned within 2 minutes; the same 7 calls run
  // sequentially completed in 1.9s). This is the same class of bug found in PR#56's
  // fetchAiQuota (two queries hanging when run concurrently on the shared `max: 1` postgres
  // connection, lib/db/index.ts) — that fix made the queries *inside* one function sequential;
  // this one makes the *page-level* fan-out sequential too, since apparently the trigger isn't
  // limited to a single function's own internal concurrency. Root cause still not fully
  // understood; sequential is the safe, verified-correct choice until it is.
  const health = await fetchSystemHealth()
  const metrics = await fetchBusinessMetrics()
  const points = await fetchPointsBreakdown()
  const revenue = await fetchRevenueBreakdown()
  const aiQuota = await fetchAiQuota()
  const activity = await fetchTeamActivity()
  const calculatorUsage = await fetchCalculatorUsage()

  return { props: { authenticated: true, health, metrics, points, revenue, aiQuota, activity, calculatorUsage } }
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

  const { health, metrics, points, revenue, aiQuota, activity, calculatorUsage } = props
  const overall = overallHealth([health.fe.status, health.be.status, activity.status])

  const pointsBreakdown = (
    <>
      <p className="mb-1 text-xs text-ops_text_muted">เข้า</p>
      {points.in.map((r) => (
        <BreakdownRow key={r.label} label={r.label} value={`+${r.points.toLocaleString('th-TH')}`} />
      ))}
      <p className="mb-1 mt-2 text-xs text-ops_text_muted">ออก</p>
      {points.out.map((r) => (
        <BreakdownRow key={r.label} label={r.label} value={r.points.toLocaleString('th-TH')} />
      ))}
    </>
  )

  const revenueBreakdown =
    revenue.length === 0 ? (
      <p className="text-xs text-ops_text_muted">ไม่มีรายการวันนี้</p>
    ) : (
      <>
        <SegmentedBar segments={revenue.map((r) => ({ label: r.plan, amount: r.amount }))} />
        {revenue.map((r) => (
          <BreakdownRow key={r.plan} label={r.plan} value={`฿${r.amount.toLocaleString('th-TH')}`} />
        ))}
      </>
    )

  const aiQuotaBreakdown = (
    <>
      <BreakdownRow label="ฟรีเริ่มต้น" value={aiQuota.welcome.toLocaleString('th-TH')} />
      {aiQuota.purchasedByPlan.map((p) => (
        <BreakdownRow key={p.plan} label={p.plan} value={p.credits.toLocaleString('th-TH')} />
      ))}
    </>
  )

  const calculatorTrendBreakdown = (
    <>
      {calculatorUsage.trend.map((d) => (
        <BreakdownRow key={d.label} label={d.label} value={d.count.toLocaleString('th-TH')} />
      ))}
    </>
  )

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
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-6">
              <MetricCard
                title="ขอดูดวง"
                subtitle="ครั้ง·วันนี้"
                value={metrics.calculate.count}
                delta={metrics.calculate.delta}
                unit="ครั้ง"
              />
              <MetricCard
                title="Survey"
                subtitle="ครั้ง·วันนี้"
                value={metrics.survey.count}
                delta={metrics.survey.delta}
                unit="ครั้ง"
              />
              <MetricCard
                title="แต้ม"
                subtitle="สุทธิ·เข้าออก"
                value={metrics.activityPoints.points}
                delta={metrics.activityPoints.deltaPoints}
                unit="พอยต์"
                breakdown={pointsBreakdown}
              />
              <MetricCard
                title="Revenue"
                subtitle="รวม 3 แพลน"
                value={metrics.revenue.amount}
                delta={metrics.revenue.deltaAmount}
                unit="บาท"
                breakdown={revenueBreakdown}
              />
              <QuotaCard
                title="AI Chat"
                subtitle="เครดิตสะสม·ไม่รวม MEMBER"
                used={aiQuota.used}
                capacity={aiQuota.granted}
                breakdown={aiQuotaBreakdown}
              />
              <MetricCard
                title="Public Calculator"
                subtitle="ครั้ง·วันนี้"
                value={calculatorUsage.today}
                delta={calculatorUsage.delta}
                unit="ครั้ง"
                breakdown={calculatorTrendBreakdown}
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
