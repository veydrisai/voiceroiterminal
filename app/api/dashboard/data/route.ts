import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getOrCreateTenant, getTenantByUserId } from '@/lib/db-helpers'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'

export const dynamic = 'force-dynamic'

const debugLog = (msg: string) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG === '1' || process.env.DEBUG === 'true') {
    console.log(`[dashboard/data] ${msg}`)
  }
}

export async function GET(request: NextRequest) {
  try {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session) {
    debugLog('unauthenticated')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tenant = await getTenantByUserId(session.userId)
  if (!tenant) {
    const tenantId = await getOrCreateTenant({
      userId: session.userId,
      email: session.email,
      role: session.role,
      onboardingComplete: session.onboardingComplete,
      allowedModules: session.allowedModules,
    })
    tenant = await getTenantByUserId(session.userId)
    if (!tenant) {
      return NextResponse.json({
        kpis: {
          dailyCallVolume: 0,
          confirmedBookings: 0,
          projectedRevenue: 0,
          weeklyCallVolume: 0,
          weeklySalesYield: 0,
          monthlyGrossYield: 0,
        },
        pipelineRows: [],
        lastSync: 'No data yet',
      })
    }
  }

  const sql = getSql()
  const tenantId = tenant.id
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(now)
  monthStart.setDate(monthStart.getDate() - 30)

  const weekStartIso = weekStart.toISOString()
  const monthStartIso = monthStart.toISOString()

  const [dailyCallsRows, dailyBookingsRows, weeklyCallsRows, weeklyBookingsRows, monthlyCallsRows, monthlyBookingsRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${todayStart}`,
    sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(value_cents), 0)::int AS rev FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${todayStart} AND status != 'cancelled'`,
    sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${weekStartIso}`,
    sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${weekStartIso} AND status != 'cancelled'`,
    sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${monthStartIso}`,
    sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${monthStartIso} AND status != 'cancelled'`,
  ])

  const dailyCalls = (dailyCallsRows as { c: number }[])[0]
  const dailyBookings = (dailyBookingsRows as { c: number; rev: number }[])[0]
  const weeklyCalls = (weeklyCallsRows as { c: number }[])[0]
  const weeklyBookings = (weeklyBookingsRows as { c: number }[])[0]
  const monthlyCalls = (monthlyCallsRows as { c: number }[])[0]
  const monthlyBookings = (monthlyBookingsRows as { c: number }[])[0]

  const dailyCallVolume = dailyCalls?.c ?? 0
  const confirmedBookings = dailyBookings?.c ?? 0
  const projectedRevenue = Math.round((dailyBookings?.rev ?? 0) / 100)
  const weeklyCallVolume = weeklyCalls?.c ?? 0
  const weeklySalesYield = weeklyCallVolume > 0 ? ((weeklyBookings?.c ?? 0) / weeklyCallVolume) * 100 : 0
  const monthlyGrossYield = (monthlyCalls?.c ?? 0) > 0 ? ((monthlyBookings?.c ?? 0) / (monthlyCalls?.c ?? 1)) * 100 : 0

  const pipelineRowsRaw = await sql`
    SELECT c.id, c.created_at, cl.from_number AS caller, c.intent, c.outcome, c.revenue_cents
    FROM conversations c
    LEFT JOIN calls cl ON cl.id = c.call_id
    WHERE c.tenant_id = ${tenantId}
    ORDER BY c.created_at DESC
    LIMIT 50`
  const pipelineRows = (pipelineRowsRaw as { id: string; created_at: Date; caller: string | null; intent: string | null; outcome: string | null; revenue_cents: number }[]).map((r) => ({
    id: r.id,
    time: new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    caller: r.caller ?? 'Unknown',
    intent: labelIntent(r.intent),
    outcome: labelOutcome(r.outcome),
    revenue: Math.round((r.revenue_cents ?? 0) / 100),
  }))

  const lastSync = now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  return NextResponse.json({
    kpis: {
      dailyCallVolume,
      confirmedBookings,
      projectedRevenue,
      weeklyCallVolume,
      weeklySalesYield: Math.round(weeklySalesYield * 10) / 10,
      monthlyGrossYield: Math.round(monthlyGrossYield * 10) / 10,
    },
    pipelineRows,
    lastSync,
  })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    debugLog('db error: ' + msg)
    return NextResponse.json({ error: 'Server error', detail: msg }, { status: 500 })
  }
}
