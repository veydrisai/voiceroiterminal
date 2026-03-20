import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getUserById } from '@/lib/userStore'
import { getSql } from '@/lib/db'
import { getOrCreateTenant, getTenantByUserId } from '@/lib/db-helpers'

type RouteParams = { clientId: string }
type RevenueSettings = {
  defaultRevenuePerBooking?: number
  currency?: string
}

async function getClientId(params: RouteParams | Promise<RouteParams>): Promise<string | null> {
  const resolved: RouteParams =
    typeof (params as Promise<RouteParams>).then === 'function'
      ? await (params as Promise<RouteParams>)
      : (params as RouteParams)
  return resolved?.clientId ?? null
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
    return NextResponse.json({ settings: {} })
  }

  const sql = getSql()
  const rows = await sql`
    SELECT default_revenue_per_booking, currency
    FROM tenant_settings WHERE tenant_id = ${tenant.id} LIMIT 1`
  const s = (rows as { default_revenue_per_booking: number; currency: string }[])[0]

  const result = s ? {
    defaultRevenuePerBooking: s.default_revenue_per_booking ?? 0,
    currency: s.currency ?? 'USD',
  } : {}

  return NextResponse.json({ settings: result })
}

export async function PUT(
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

  let body: RevenueSettings
  try {
    body = (await request.json()) as RevenueSettings
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantId = await getOrCreateTenant({
    userId: clientId,
    email: user.email,
    role: user.role,
    onboardingComplete: user.onboardingComplete,
    allowedModules: user.allowedModules,
  })

  const sql = getSql()
  await sql`
    INSERT INTO tenant_settings (tenant_id, default_revenue_per_booking, currency)
    VALUES (${tenantId}, ${body.defaultRevenuePerBooking ?? 0}, ${body.currency ?? 'USD'})
    ON CONFLICT (tenant_id) DO UPDATE SET
      default_revenue_per_booking = EXCLUDED.default_revenue_per_booking,
      currency = EXCLUDED.currency,
      updated_at = now()`

  return NextResponse.json({ ok: true })
}
