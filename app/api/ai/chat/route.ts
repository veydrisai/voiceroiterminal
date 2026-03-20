import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getTenantByUserId } from '@/lib/db-helpers'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'
import { answerDataQuestion, type KPIs, type PipelineRow } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value
    const session = parseSessionCookie(cookie)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { question } = body
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 })
    }
    if (question.length > 500) {
      return NextResponse.json({ error: 'Question too long (max 500 chars)' }, { status: 400 })
    }

    const tenant = await getTenantByUserId(session.userId)
    if (!tenant) {
      return NextResponse.json({ answer: 'No data yet — connect your voice AI to start asking questions.' })
    }

    const sql = getSql()
    const tenantId = tenant.id
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now)
    monthStart.setDate(monthStart.getDate() - 30)

    const [dailyCallsRows, dailyBookingsRows, weeklyCallsRows, weeklyBookingsRows, monthlyCallsRows, monthlyBookingsRows, pipelineRaw] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${todayStart}`,
      sql`SELECT COUNT(*)::int AS c, COALESCE(SUM(value_cents), 0)::int AS rev FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${todayStart} AND status != 'cancelled'`,
      sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${weekStart.toISOString()}`,
      sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${weekStart.toISOString()} AND status != 'cancelled'`,
      sql`SELECT COUNT(*)::int AS c FROM calls WHERE tenant_id = ${tenantId} AND created_at >= ${monthStart.toISOString()}`,
      sql`SELECT COUNT(*)::int AS c FROM bookings WHERE tenant_id = ${tenantId} AND created_at >= ${monthStart.toISOString()} AND status != 'cancelled'`,
      sql`SELECT cl.from_number AS caller, c.intent, c.outcome, c.revenue_cents FROM conversations c LEFT JOIN calls cl ON cl.id = c.call_id WHERE c.tenant_id = ${tenantId} ORDER BY c.created_at DESC LIMIT 50`,
    ])

    const dailyCalls = (dailyCallsRows as { c: number }[])[0]
    const dailyBookings = (dailyBookingsRows as { c: number; rev: number }[])[0]
    const weeklyCalls = (weeklyCallsRows as { c: number }[])[0]
    const weeklyBookings = (weeklyBookingsRows as { c: number }[])[0]
    const monthlyCalls = (monthlyCallsRows as { c: number }[])[0]
    const monthlyBookings = (monthlyBookingsRows as { c: number }[])[0]

    const weeklyCallVolume = weeklyCalls?.c ?? 0
    const kpis: KPIs = {
      dailyCallVolume: dailyCalls?.c ?? 0,
      confirmedBookings: dailyBookings?.c ?? 0,
      projectedRevenue: Math.round((dailyBookings?.rev ?? 0) / 100),
      weeklyCallVolume,
      weeklySalesYield: weeklyCallVolume > 0 ? Math.round(((weeklyBookings?.c ?? 0) / weeklyCallVolume) * 1000) / 10 : 0,
      monthlyGrossYield: (monthlyCalls?.c ?? 0) > 0 ? Math.round(((monthlyBookings?.c ?? 0) / (monthlyCalls?.c ?? 1)) * 1000) / 10 : 0,
    }

    const recentCalls: PipelineRow[] = (pipelineRaw as { caller: string | null; intent: string | null; outcome: string | null; revenue_cents: number }[]).map((r) => ({
      time: '',
      caller: r.caller ?? 'Unknown',
      intent: labelIntent(r.intent),
      outcome: labelOutcome(r.outcome, r.intent),
      revenue: Math.round((r.revenue_cents ?? 0) / 100),
    }))

    const answer = await answerDataQuestion(question.trim(), kpis, recentCalls)
    return NextResponse.json({ answer })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai/chat] error:', msg)
    return NextResponse.json({ error: 'Failed to get answer', detail: msg }, { status: 500 })
  }
}
