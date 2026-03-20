-- VoiceROI Terminal – Neon schema (no RLS; app enforces tenant_id)
-- Run this once in Neon SQL Editor (Dashboard → SQL Editor) or via psql.

-- App users (replaces data/users.json file storage)
CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'client',
  onboarding_complete boolean DEFAULT false,
  allowed_modules text[] DEFAULT ARRAY['performance', 'analytics', 'system'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_users_updated_at') THEN
    CREATE TRIGGER update_app_users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'client',
  onboarding_complete boolean DEFAULT false,
  allowed_modules text[] DEFAULT ARRAY['performance', 'analytics', 'system'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

-- Tenant credentials
CREATE TABLE IF NOT EXISTS tenant_credentials (
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
);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant ON tenant_credentials(tenant_id);

-- Tenant settings
CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  default_revenue_per_booking integer DEFAULT 0,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- Calls
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_sid text UNIQUE NOT NULL,
  from_number text,
  to_number text,
  duration_sec integer DEFAULT 0,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calls_tenant_created ON calls(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
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
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT conversations_tenant_external_unique UNIQUE (tenant_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_created ON conversations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_call ON conversations(call_id);
CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_id);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
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
);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_created ON bookings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_call ON bookings(call_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON bookings(tenant_id, booked_at DESC);

-- KPI snapshots (optional)
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  daily_call_volume integer DEFAULT 0,
  confirmed_bookings integer DEFAULT 0,
  projected_revenue_cents integer DEFAULT 0,
  weekly_call_volume integer DEFAULT 0,
  weekly_sales_yield numeric(5,2) DEFAULT 0,
  monthly_gross_yield numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_tenant_date ON kpi_snapshots(tenant_id, snapshot_date DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenants_updated_at') THEN
    CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_credentials_updated_at') THEN
    CREATE TRIGGER update_tenant_credentials_updated_at BEFORE UPDATE ON tenant_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_settings_updated_at') THEN
    CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calls_updated_at') THEN
    CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_conversations_updated_at') THEN
    CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_updated_at') THEN
    CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
