import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { getOrCreateTenant, getTenantByUserId } from '@/lib/db-helpers'

/** GET: health check so you can confirm the route is deployed (e.g. after 404 on sync). */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'sync-vapi' })
}

/**
 * POST /api/dashboard/sync-vapi
 * Fetches recent calls from Vapi API and imports them into conversations (and calls if we have twilioCallSid).
 * Uses the tenant's Vapi API key from tenant_credentials.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session) {
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
    tenant = { id: tenantId } as Awaited<ReturnType<typeof getTenantByUserId>>
  }
  const tenantId = tenant!.id

  const sql = getSql()
  const credRows = await sql`
    SELECT vapi_api_key FROM tenant_credentials WHERE tenant_id = ${tenantId} LIMIT 1`
  const cred = (credRows as { vapi_api_key: string | null }[])[0]
  const vapiApiKey = cred?.vapi_api_key?.trim()
  if (!vapiApiKey) {
    return NextResponse.json(
      {
        error: 'Only your Vapi API key is needed for Sync. In Settings, paste your Private API key from dashboard.vapi.ai, click Save changes, then try Sync again.',
      },
      { status: 400 }
    )
  }

  const limit = 100
  const createdAtGe = new Date()
  createdAtGe.setDate(createdAtGe.getDate() - 90) // last 90 days
  const url = new URL('https://api.vapi.ai/call')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('createdAtGe', createdAtGe.toISOString())

  let vapiCalls: Array<{
    id?: string
    duration?: number
    analysis?: { intent?: string; outcome?: string }
    endedReason?: string
    metadata?: { twilioCallSid?: string }
    createdAt?: string
  }>

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${vapiApiKey}` },
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('Vapi API error:', res.status, text)
      const msg = res.status === 404
        ? 'Vapi list-calls endpoint not found. Check Vapi API key (use Private key from dashboard) and their docs.'
        : `Vapi API error: ${res.status}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }
    vapiCalls = await res.json()
  } catch (e) {
    console.error('Vapi fetch error:', e)
    return NextResponse.json({ error: 'Failed to fetch from Vapi' }, { status: 502 })
  }

  if (!Array.isArray(vapiCalls)) {
    return NextResponse.json({ error: 'Invalid response from Vapi' }, { status: 502 })
  }

  let imported = 0
  for (const v of vapiCalls) {
    const externalId = v.id
    if (!externalId) continue

    const existing = await sql`
      SELECT id FROM conversations WHERE tenant_id = ${tenantId} AND external_id = ${externalId} LIMIT 1`
    if ((existing as { id: string }[]).length > 0) continue

    let callId: string | null = null
    const twilioSid = v.metadata?.twilioCallSid
    if (twilioSid) {
      const callRows = await sql`
        SELECT id FROM calls WHERE tenant_id = ${tenantId} AND call_sid = ${twilioSid} LIMIT 1`
      const c = (callRows as { id: string }[])[0]
      if (c) callId = c.id
      else {
        const ins = await sql`
          INSERT INTO calls (tenant_id, call_sid, duration_sec, status, created_at, updated_at)
          VALUES (${tenantId}, ${twilioSid}, ${v.duration ?? 0}, 'completed', ${v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString()}, now())
          ON CONFLICT (call_sid) DO UPDATE SET updated_at = now()
          RETURNING id`
        const inserted = (ins as { id: string }[])[0]
        if (inserted) callId = inserted.id
      }
    }

    const intent = v.analysis?.intent ?? 'unknown'
    const outcome = v.analysis?.outcome ?? v.endedReason ?? 'unknown'
    const durationSec = typeof v.duration === 'number' ? v.duration : 0

    try {
      await sql`
        INSERT INTO conversations (tenant_id, call_id, external_id, intent, outcome, duration_sec, revenue_cents, metadata, created_at, updated_at)
        VALUES (${tenantId}, ${callId}, ${externalId}, ${intent}, ${outcome}, ${durationSec}, 0, ${JSON.stringify(v)}::jsonb, ${v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString()}, now())`
      imported += 1
    } catch {
      // skip duplicate or constraint error
    }
  }

  return NextResponse.json({ ok: true, imported })
}
