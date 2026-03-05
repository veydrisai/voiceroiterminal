import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getOrCreateTenant, getTenantByUserId } from '@/lib/db-helpers'

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenant = await getTenantByUserId(session.userId)
  if (!tenant) {
    return NextResponse.json({ keys: {} })
  }

  const sql = getSql()
  const credRows = await sql`
    SELECT twilio_account_sid, twilio_auth_token, vapi_api_key, crm_endpoint, webhook_secret
    FROM tenant_credentials WHERE tenant_id = ${tenant.id} LIMIT 1`
  const cred = (credRows as Record<string, string | null>[])[0]

  const keys = cred ? {
    twilioAccountSid: cred.twilio_account_sid ?? '',
    twilioAuthToken: cred.twilio_auth_token ?? '',
    vapiApiKey: cred.vapi_api_key ?? '',
    crmEndpoint: cred.crm_endpoint ?? '',
    webhookSecret: cred.webhook_secret ?? '',
  } : {}

  return NextResponse.json({ keys })
}

export async function PUT(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const tenantId = await getOrCreateTenant({
    userId: session.userId,
    email: session.email,
    role: session.role,
    onboardingComplete: session.onboardingComplete,
    allowedModules: session.allowedModules,
  })

  const vapiKey = (body.vapiApiKey ?? body.vapi_api_key ?? '').toString().trim() || null
  const sql = getSql()
  await sql`
    INSERT INTO tenant_credentials (tenant_id, twilio_account_sid, twilio_auth_token, vapi_api_key, crm_endpoint, webhook_secret)
    VALUES (${tenantId}, ${body.twilioAccountSid || null}, ${body.twilioAuthToken || null}, ${vapiKey}, ${body.crmEndpoint || null}, ${body.webhookSecret || null})
    ON CONFLICT (tenant_id) DO UPDATE SET
      twilio_account_sid = EXCLUDED.twilio_account_sid,
      twilio_auth_token = EXCLUDED.twilio_auth_token,
      vapi_api_key = EXCLUDED.vapi_api_key,
      crm_endpoint = EXCLUDED.crm_endpoint,
      webhook_secret = EXCLUDED.webhook_secret,
      updated_at = now()`

  return NextResponse.json({ ok: true })
}
