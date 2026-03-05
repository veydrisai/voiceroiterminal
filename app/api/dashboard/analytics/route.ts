import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getTenantByUserId } from '@/lib/db-helpers'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value
    const session = parseSessionCookie(cookie)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tenant = await getTenantByUserId(session.userId)
    if (!tenant) return NextResponse.json({ total: 0, avgDuration: 0, byOutcome: [], topIntents: [] })

    const range = request.nextUrl.searchParams.get('range') === '30d' ? 30 : 7
    const since = new Date()
    since.setDate(since.getDate() - range)
    const sinceIso = since.toISOString()
    const sql = getSql()
    const tenantId = tenant.id

    const [totalRows, durationRows, outcomeRows, intentRows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM conversations WHERE tenant_id = ${tenantId} AND created_at >= ${sinceIso}`,
      sql`SELECT COALESCE(AVG(duration_sec), 0)::int AS avg FROM conversations WHERE tenant_id = ${tenantId} AND created_at >= ${sinceIso}`,
      sql`SELECT outcome, COUNT(*)::int AS c FROM conversations WHERE tenant_id = ${tenantId} AND created_at >= ${sinceIso} GROUP BY outcome ORDER BY c DESC LIMIT 8`,
      sql`SELECT intent, COUNT(*)::int AS c FROM conversations WHERE tenant_id = ${tenantId} AND created_at >= ${sinceIso} GROUP BY intent ORDER BY c DESC LIMIT 5`,
    ])

    const total = (totalRows as { c: number }[])[0]?.c ?? 0
    const avgDuration = (durationRows as { avg: number }[])[0]?.avg ?? 0
    const byOutcome = (outcomeRows as { outcome: string; c: number }[]).map((r) => ({
      outcome: labelOutcome(r.outcome),
      count: r.c,
      pct: total > 0 ? Math.round((r.c / total) * 100) : 0,
    }))
    const topIntents = (intentRows as { intent: string; c: number }[]).map((r) => ({
      intent: labelIntent(r.intent),
      count: r.c,
    }))

    const mins = Math.floor(avgDuration / 60)
    const secs = avgDuration % 60
    const avgDurationStr = `${mins}:${String(secs).padStart(2, '0')}`

    return NextResponse.json({ total, avgDuration: avgDurationStr, byOutcome, topIntents })
  } catch {
    return NextResponse.json({ total: 0, avgDuration: '0:00', byOutcome: [], topIntents: [] })
  }
}
