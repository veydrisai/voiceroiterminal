import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text UNIQUE NOT NULL,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'client',
    onboarding_complete boolean DEFAULT false,
    allowed_modules text[] DEFAULT ARRAY['performance', 'analytics', 'system'],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email)`,
  `CREATE TABLE IF NOT EXISTS tenant_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    twilio_account_sid text,
    twilio_auth_token text,
    vapi_api_key text,
    crm_endpoint text,
    webhook_secret text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant ON tenant_credentials(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS tenant_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    default_revenue_per_booking integer DEFAULT 0,
    currency text DEFAULT 'USD',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id)`,
  `CREATE TABLE IF NOT EXISTS calls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_sid text UNIQUE NOT NULL,
    from_number text,
    to_number text,
    duration_sec integer DEFAULT 0,
    status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_calls_tenant_created ON calls(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid)`,
  `CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
    external_id text,
    intent text,
    outcome text,
    duration_sec integer DEFAULT 0,
    revenue_cents integer DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_tenant_created ON conversations(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_call ON conversations(call_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_id)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
    external_id text,
    contact_phone text,
    contact_email text,
    contact_name text,
    value_cents integer DEFAULT 0,
    booked_at timestamptz,
    status text DEFAULT 'confirmed',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_tenant_created ON bookings(tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_call ON bookings(call_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON bookings(tenant_id, booked_at DESC)`,
]

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  const setupSecret = process.env.SETUP_SECRET
  if (!setupSecret || secret !== setupSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sql = getSql()
  const results: string[] = []

  for (const stmt of SCHEMA_STATEMENTS) {
    const label = stmt.trim().split('\n')[0].slice(0, 60)
    try {
      await sql(stmt)
      results.push(`OK: ${label}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('duplicate key')) {
        results.push(`SKIP: ${label}`)
      } else {
        results.push(`FAIL: ${label} — ${msg}`)
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}
