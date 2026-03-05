import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    const sql = getSql()
    const tenants = await sql`SELECT id, user_id, email, created_at FROM tenants ORDER BY created_at DESC LIMIT 10`
    const creds = await sql`SELECT tenant_id, (vapi_api_key IS NOT NULL AND trim(vapi_api_key) != '') AS has_vapi, (twilio_account_sid IS NOT NULL) AS has_twilio FROM tenant_credentials`
    const convos = await sql`SELECT id, tenant_id, external_id, intent, outcome, duration_sec, created_at FROM conversations ORDER BY created_at DESC LIMIT 10`
    return NextResponse.json({ tenants, creds, convos })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
