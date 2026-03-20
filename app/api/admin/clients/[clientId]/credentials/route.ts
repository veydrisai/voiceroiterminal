import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getUserById } from '@/lib/userStore'
import { getSql } from '@/lib/db'
import { getOrCreateTenant, getTenantByUserId } from '@/lib/db-helpers'

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
  if (!user) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const tenant = await getTenantByUserId(clientId)
  if (!tenant) return NextResponse.json({ credentials: {} })

  const sql = getSql()
  const rows = await sql`
    SELECT twilio_account_sid, twilio_auth_token, vapi_api_key, crm_endpoint, webhook_secret
    FROM tenant_credentials WHERE tenant_id = ${tenant.id} LIMIT 1`
  const cred = (rows as Record<string, string | null>[])[0]

  return NextResponse.json({
    credentials: cred ? {
      twilioAccountSid: cred.twilio_account_sid ?? '',
      twilioAuthToken: cred.twilio_auth_token ?? '',
      vapiApiKey: cred.vapi_api_key ?? '',
      crmEndpoint: cred.crm_endpoint ?? '',
      webhookSecret: cred.webhook_secret ?? '',
    } : {}
  })
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
  const { clientId } = await resolveParams(context.params)
  const user = await getUserById(clientId)
  if (!user) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await request.json()
  const tenantId = await getOrCreateTenant({
    userId: clientId,
    email: user.email,
    role: user.role,
    onboardingComplete: user.onboardingComplete,
    allowedModules: user.allowedModules,
  })

  const sql = getSql()
  await sql`
    INSERT INTO tenant_credentials (tenant_id, twilio_account_sid, twilio_auth_token, vapi_api_key, crm_endpoint, webhook_secret)
    VALUES (${tenantId}, ${body.twilioAccountSid || null}, ${body.twilioAuthToken || null}, ${body.vapiApiKey || null}, ${body.crmEndpoint || null}, ${body.webhookSecret || null})
    ON CONFLICT (tenant_id) DO UPDATE SET
      twilio_account_sid = EXCLUDED.twilio_account_sid,
      twilio_auth_token = EXCLUDED.twilio_auth_token,
      vapi_api_key = EXCLUDED.vapi_api_key,
      crm_endpoint = EXCLUDED.crm_endpoint,
      webhook_secret = EXCLUDED.webhook_secret,
      updated_at = now()`

  return NextResponse.json({ ok: true })
}
