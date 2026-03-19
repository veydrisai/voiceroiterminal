import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { labelIntent, labelOutcome } from '@/lib/vapiLabels'

export async function POST(request: NextRequest) {
  try {
    const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (vapiSecret) {
      const signature = request.headers.get('x-vapi-signature');
      if (!signature || signature !== vapiSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json()
    const { message } = body

    if (message?.type !== 'end-of-call-report') {
      return NextResponse.json({ success: true, skipped: true })
    }

    // Vapi puts call data inside message.call, not at the top level
    const call = message?.call
    const callId = call?.id
    const callSid = call?.metadata?.twilioCallSid || callId

    if (!callSid) {
      return NextResponse.json({ error: 'Missing call identifier' }, { status: 400 })
    }

    // Keep intent and summary separate — don't fall back to summary as raw intent
    const rawIntent = message?.analysis?.intent ?? null
    const summary = message?.analysis?.summary ?? null
    const rawOutcome = message?.analysis?.outcome ?? message?.endedReason ?? 'unknown'
    const intent = labelIntent(rawIntent, summary)
    const outcome = labelOutcome(rawOutcome, rawIntent, summary)
    const duration = call?.duration || 0

    const sql = getSql()

    // Try to find an existing call record by call_sid
    const callRows = await sql`
      SELECT id, tenant_id FROM calls WHERE call_sid = ${callSid} LIMIT 1`
    const existingCall = (callRows as { id: string; tenant_id: string }[])[0]

    let tenantId: string
    let callDbId: string | null = null

    if (existingCall) {
      tenantId = existingCall.tenant_id
      callDbId = existingCall.id
    } else {
      // Vapi-only call (no Twilio): find tenant by Vapi key, create call record
      const credRows = await sql`
        SELECT tenant_id FROM tenant_credentials
        WHERE vapi_api_key IS NOT NULL AND trim(vapi_api_key) != ''
        LIMIT 1`
      const cred = (credRows as { tenant_id: string }[])[0]
      if (!cred) {
        return NextResponse.json({ error: 'No tenant found for this call' }, { status: 404 })
      }
      tenantId = cred.tenant_id

      // Create a call record for this Vapi call
      const ins = await sql`
        INSERT INTO calls (tenant_id, call_sid, duration_sec, status, created_at, updated_at)
        VALUES (${tenantId}, ${callSid}, ${duration}, 'completed', now(), now())
        ON CONFLICT (call_sid) DO UPDATE SET updated_at = now()
        RETURNING id`
      callDbId = (ins as { id: string }[])[0]?.id ?? null
    }

    // Check for duplicate conversation
    const existing = await sql`
      SELECT id FROM conversations WHERE tenant_id = ${tenantId} AND external_id = ${callId} LIMIT 1`
    if ((existing as { id: string }[]).length > 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'duplicate' })
    }

    await sql`
      INSERT INTO conversations (tenant_id, call_id, external_id, intent, outcome, duration_sec, revenue_cents, metadata, created_at, updated_at)
      VALUES (${tenantId}, ${callDbId}, ${callId}, ${intent}, ${outcome}, ${duration}, 0, ${JSON.stringify(body)}::jsonb, now(), now())`

    return NextResponse.json({ success: true, callId })
  } catch (error) {
    console.error('Vapi webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
