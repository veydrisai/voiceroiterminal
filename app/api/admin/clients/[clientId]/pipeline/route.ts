import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getTenantByUserId } from '@/lib/db-helpers'
import { getUserById } from '@/lib/userStore'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'

type RouteParams = { clientId: string }

async function getClientId(params: RouteParams | Promise<RouteParams>): Promise<string | null> {
  const resolved: RouteParams =
    typeof (params as Promise<RouteParams>).then === 'function'
      ? await (params as Promise<RouteParams>)
      : (params as RouteParams)
  return resolved?.clientId ?? null
}

/**
 * GET /api/admin/clients/[clientId]/pipeline
 * Admin only. Returns the conversation pipeline (leads) for the given client (user id).
 */
export async function GET(
  request: NextRequest,
  context: { params: RouteParams | Promise<RouteParams> }
) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const clientId = await getClientId(context.params)
  if (!clientId) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const user = await getUserById(clientId)
  if (!user || user.role !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const tenant = await getTenantByUserId(clientId)
  if (!tenant) {
    return NextResponse.json({ pipelineRows: [] })
  }

  const sql = getSql()
  const pipelineRowsRaw = await sql`
    SELECT c.id, c.created_at, cl.from_number AS caller, c.intent, c.outcome, c.revenue_cents
    FROM conversations c
    LEFT JOIN calls cl ON cl.id = c.call_id
    WHERE c.tenant_id = ${tenant.id}
    ORDER BY c.created_at DESC
    LIMIT 100`
  const pipelineRows = (pipelineRowsRaw as { id: string; created_at: Date; caller: string | null; intent: string | null; outcome: string | null; revenue_cents: number }[]).map((r) => ({
    id: r.id,
    time: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    caller: r.caller ?? 'Unknown',
    intent: labelIntent(r.intent),
    outcome: labelOutcome(r.outcome, r.intent),
    revenue: Math.round((r.revenue_cents ?? 0) / 100),
  }))

  return NextResponse.json({ pipelineRows })
}
