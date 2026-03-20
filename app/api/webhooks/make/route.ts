import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret from header or query param
    const providedSecret = request.headers.get('x-webhook-secret') ?? new URL(request.url).searchParams.get('secret');

    const body = await request.json()
    const {
      tenantId,
      appointmentId,
      contactPhone,
      contactEmail,
      contactName,
      value,
      bookedAt,
      callSid,
      status = 'confirmed'
    } = body

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!tenantId || !UUID_RE.test(tenantId)) {
      return NextResponse.json({ error: 'Missing or invalid tenant ID' }, { status: 400 })
    }

    const sql = getSql()

    // Fetch tenant credentials to verify webhook secret
    const credRows = await sql`
      SELECT webhook_secret FROM tenant_credentials WHERE tenant_id = ${tenantId} LIMIT 1`
    const cred = (credRows as { webhook_secret: string | null }[])[0]

    // Always enforce secret — if no credentials row exists OR secret is not configured,
    // reject the request. Tenants must configure a webhook secret in Settings.
    if (!cred || !cred.webhook_secret) {
      return NextResponse.json({ error: 'Webhook secret not configured for this tenant' }, { status: 403 })
    }
    if (!providedSecret || providedSecret !== cred.webhook_secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate revenue
    const rawRevenue = body.revenue ?? body.value ?? 0;
    const revenue = Number(rawRevenue);
    if (!isFinite(revenue) || revenue < 0) {
      return NextResponse.json({ error: 'Invalid revenue value' }, { status: 400 });
    }

    // Validate date if provided
    if (body.booked_at) {
      const ts = Date.parse(body.booked_at);
      if (isNaN(ts)) {
        return NextResponse.json({ error: 'Invalid booked_at date' }, { status: 400 });
      }
    }

    // Sanitize strings
    const intent = typeof body.intent === 'string' ? body.intent.slice(0, 100) : null;
    const outcome = typeof body.outcome === 'string' ? body.outcome.slice(0, 100) : null;
    void intent; void outcome; // available for future use

    let callId: string | null = null
    if (callSid) {
      const callRows = await sql`
        SELECT id FROM calls WHERE call_sid = ${callSid} AND tenant_id = ${tenantId} LIMIT 1`
      const call = (callRows as { id: string }[])[0]
      if (call) callId = call.id
    }

    const settingsRows = await sql`
      SELECT default_revenue_per_booking FROM tenant_settings WHERE tenant_id = ${tenantId} LIMIT 1`
    const settings = (settingsRows as { default_revenue_per_booking: number | null }[])[0]
    const valueCents = value != null ? Math.round(Number(value) * 100) : (settings?.default_revenue_per_booking ?? 0)

    const bookedAtVal = bookedAt ? new Date(bookedAt).toISOString() : new Date().toISOString()
    await sql`
      INSERT INTO bookings (tenant_id, call_id, external_id, contact_phone, contact_email, contact_name, value_cents, booked_at, status, metadata)
      VALUES (${tenantId}, ${callId}, ${appointmentId ?? null}, ${contactPhone ?? null}, ${contactEmail ?? null}, ${contactName ?? null}, ${valueCents}, ${bookedAtVal}, ${status}, ${JSON.stringify(body)}::jsonb)`

    if (callId) {
      await sql`
        UPDATE conversations SET revenue_cents = ${valueCents}, updated_at = now()
        WHERE call_id = ${callId}`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Make.com webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
