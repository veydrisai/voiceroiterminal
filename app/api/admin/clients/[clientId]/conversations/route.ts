import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getUserById } from '@/lib/userStore'
import { getSql } from '@/lib/db'
import { getTenantByUserId } from '@/lib/db-helpers'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'

type RouteParams = { clientId: string }

async function resolveParams(params: RouteParams | Promise<RouteParams>): Promise<RouteParams> {
  return typeof (params as Promise<RouteParams>).then === 'function'
    ? await (params as Promise<RouteParams>)
    : (params as RouteParams)
}

export async function GET(
  request: NextRequest,
  context: { params: RouteParams | Promise<RouteParams> }
) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId } = await resolveParams(context.params)
  const user = await getUserById(clientId)
  if (!user) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const tenant = await getTenantByUserId(clientId)
  if (!tenant) {
    return NextResponse.json({ conversations: [] })
  }

  const searchParams = request.nextUrl.searchParams
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 100)
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10)
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
  const offset = (page - 1) * limit

  const sql = getSql()
  const rows = await sql`
    SELECT c.id, c.created_at, c.intent, c.outcome, c.revenue_cents, c.duration_sec,
           cl.from_number AS caller
    FROM conversations c
    LEFT JOIN calls cl ON cl.id = c.call_id
    WHERE c.tenant_id = ${tenant.id}
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`

  const conversations = (rows as {
    id: string
    created_at: Date
    intent: string | null
    outcome: string | null
    revenue_cents: number
    duration_sec: number
    caller: string | null
  }[]).map((r) => ({
    id: r.id,
    time: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' ' + new Date(r.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    caller: r.caller ?? 'Unknown',
    intent: labelIntent(r.intent),
    outcome: labelOutcome(r.outcome, r.intent),
    revenue: Math.round((r.revenue_cents ?? 0) / 100),
    durationSec: r.duration_sec ?? 0,
    // raw values for editing
    rawIntent: r.intent ?? '',
    rawOutcome: r.outcome ?? '',
  }))

  return NextResponse.json({ conversations, pagination: { page, limit } })
}
