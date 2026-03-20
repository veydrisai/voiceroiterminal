import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getSql } from '@/lib/db'

/**
 * Validates Twilio's HMAC-SHA1 webhook signature.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const sorted = Object.keys(params).sort()
  const str = url + sorted.map((k) => k + params[k]).join('')
  const expected = createHmac('sha1', authToken).update(str, 'utf8').digest('base64')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const twilioSignature = request.headers.get('x-twilio-signature')
    if (!twilioSignature) {
      return NextResponse.json({ error: 'Missing Twilio signature' }, { status: 401 })
    }

    // Buffer form body into params map — required for signature computation
    const formData = await request.formData()
    const params: Record<string, string> = {}
    formData.forEach((value, key) => { params[key] = String(value) })

    const callSid = params['CallSid']
    const accountSid = params['AccountSid']
    const from = params['From']
    const to = params['To']
    const duration = params['CallDuration']
    const status = params['CallStatus']

    if (!callSid || !accountSid) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const sql = getSql()

    // Fetch tenant + auth token using AccountSid
    const credRows = await sql`
      SELECT tenant_id, twilio_auth_token
      FROM tenant_credentials
      WHERE twilio_account_sid = ${accountSid} LIMIT 1`
    const cred = (credRows as { tenant_id: string; twilio_auth_token: string | null }[])[0]

    if (!cred) {
      return NextResponse.json({ error: 'Tenant not found for Account SID' }, { status: 404 })
    }

    // Full HMAC-SHA1 validation when auth token is on file
    if (cred.twilio_auth_token) {
      const valid = validateTwilioSignature(cred.twilio_auth_token, request.url, params, twilioSignature)
      if (!valid) {
        console.error('[twilio-webhook] Invalid HMAC-SHA1 signature for tenant', cred.tenant_id)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const durationSec = duration ? parseInt(duration, 10) : 0
    await sql`
      INSERT INTO calls (tenant_id, call_sid, from_number, to_number, duration_sec, status)
      VALUES (${cred.tenant_id}, ${callSid}, ${from ?? null}, ${to ?? null}, ${durationSec}, ${status || 'completed'})
      ON CONFLICT (call_sid) DO UPDATE SET
        from_number = EXCLUDED.from_number,
        to_number = EXCLUDED.to_number,
        duration_sec = EXCLUDED.duration_sec,
        status = EXCLUDED.status,
        updated_at = now()`

    return NextResponse.json({ success: true, callSid })
  } catch (error) {
    console.error('[twilio-webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
