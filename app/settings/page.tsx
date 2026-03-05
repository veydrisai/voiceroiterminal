'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import '@/app/dashboard/terminal.css'
import '@/app/settings/settings.css'
import { SessionProvider } from '@/contexts/SessionContext'
import { DemoSessionProvider } from '@/components/terminal/DemoSessionProvider'
import { SessionGuard } from '@/components/terminal/SessionGuard'
import Sidebar from '@/components/terminal/Sidebar'

const FIELDS = [
  { key: 'twilioAccountSid', label: 'Twilio Account SID', type: 'text' },
  { key: 'twilioAuthToken', label: 'Twilio Auth Token', type: 'password' },
  { key: 'vapiApiKey', label: 'Vapi API Key', type: 'password' },
  { key: 'crmEndpoint', label: 'CRM / Make.com webhook target URL', type: 'text' },
  { key: 'webhookSecret', label: 'Webhook secret (optional)', type: 'password' },
] as const

const API_KEY_LINKS = [
  { name: 'Twilio Console', url: 'https://console.twilio.com', note: 'Account → Account info → Account SID & Auth token' },
  { name: 'Twilio Sign up', url: 'https://www.twilio.com/try-twilio', note: 'If you don’t have an account' },
  { name: 'Vapi Dashboard', url: 'https://dashboard.vapi.ai', note: 'Settings / API Keys → Private API Key' },
  { name: 'Vapi Sign up', url: 'https://vapi.ai', note: 'If you don’t have an account' },
  { name: 'Make.com', url: 'https://www.make.com', note: 'Create a scenario; send appointments to your webhook URL' },
] as const

export default function SettingsPage() {
  const router = useRouter()
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [revenue, setRevenue] = useState<{ defaultRevenuePerBooking: string; currency: string }>({ defaultRevenuePerBooking: '', currency: 'USD' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revenueSaving, setRevenueSaving] = useState(false)
  const [apiKeyMsg, setApiKeyMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [revenueMsg, setRevenueMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/users/api-keys', { credentials: 'include' }),
      fetch('/api/users/revenue-settings', { credentials: 'include' }),
    ])
      .then(([rKeys, rRev]) => {
        if (rKeys.status === 401) {
          router.replace('/login')
          return null
        }
        return Promise.all([rKeys.json(), rRev.json()])
      })
      .then((data) => {
        if (!data) return
        const [dataKeys, dataRev] = data
        if (dataKeys?.keys) setKeys(dataKeys.keys)
        if (dataRev?.settings) {
          const s = dataRev.settings
          setRevenue({
            defaultRevenuePerBooking: s.defaultRevenuePerBooking != null ? String(s.defaultRevenuePerBooking) : '',
            currency: s.currency ?? 'USD',
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setApiKeyMsg(null)
    setSaving(true)
    try {
      const res = await fetch(‘/api/users/api-keys’, {
        method: ‘PUT’,
        headers: { ‘Content-Type’: ‘application/json’ },
        credentials: ‘include’,
        body: JSON.stringify(keys),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setApiKeyMsg({ text: err?.error || ‘Failed to save. Check you are logged in.’, ok: false })
        return
      }
      setApiKeyMsg({ text: ‘Saved. Use “Sync from Vapi” on the dashboard to load data.’, ok: true })
    } catch {
      setApiKeyMsg({ text: ‘Something went wrong’, ok: false })
    } finally {
      setSaving(false)
    }
  }

  async function handleRevenueSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRevenueMsg(null)
    setRevenueSaving(true)
    try {
      const res = await fetch(‘/api/users/revenue-settings’, {
        method: ‘PUT’,
        headers: { ‘Content-Type’: ‘application/json’ },
        credentials: ‘include’,
        body: JSON.stringify({
          defaultRevenuePerBooking: revenue.defaultRevenuePerBooking === ‘’ ? undefined : Number(revenue.defaultRevenuePerBooking),
          currency: revenue.currency || undefined,
        }),
      })
      if (!res.ok) {
        setRevenueMsg({ text: ‘Failed to save revenue settings’, ok: false })
        return
      }
      setRevenueMsg({ text: ‘Revenue settings saved.’, ok: true })
    } catch {
      setRevenueMsg({ text: ‘Something went wrong’, ok: false })
    } finally {
      setRevenueSaving(false)
    }
  }

  return (
    <SessionProvider>
      <SessionGuard>
        <DemoSessionProvider>
          <div className="terminal">
            <Sidebar />
            <main className="terminal-main settings-main">
              <h1 className="settings-title">Settings</h1>
              <p className="settings-desc">Update your API keys and integration endpoints. These are used when you connect the dashboard.</p>

              <div className="settings-card liquid-card">
                <h2 className="settings-card-title">API & Integrations</h2>
                <p className="settings-help">
                  Use your own accounts: each client enters their own Twilio, Vapi, and Make.com details. Admin can use their keys here to verify live data.
                </p>
                <details className="settings-links-detail">
                  <summary className="settings-links-summary">Where do I get these? (links)</summary>
                  <ul className="settings-links-list">
                    {API_KEY_LINKS.map((item) => (
                      <li key={item.url}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="settings-link">
                          {item.name}
                        </a>
                        <span className="settings-link-note">{item.note}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="settings-help">
                    Full guide: <code className="settings-code">docs/CLIENT_SETUP_GUIDE.md</code> in the repo (or ask your admin for the “Where to get API keys” doc).
                  </p>
                </details>
                {loading ? (
                  <p className="admin-muted">Loading…</p>
                ) : (
                  <form onSubmit={handleSubmit} className="settings-form">
                    {FIELDS.map((f) => (
                      <label key={f.key} className="settings-field">
                        <span className="auth-label">{f.label}</span>
                        <input
                          type={f.type}
                          className="auth-input"
                          value={keys[f.key] ?? ''}
                          onChange={(e) => setKeys((k) => ({ ...k, [f.key]: e.target.value }))}
                          placeholder={f.key === 'crmEndpoint' ? 'https://your-app.com/api/webhooks/make' : ''}
                          autoComplete="off"
                        />
                      </label>
                    ))}
                    {apiKeyMsg && <p className={apiKeyMsg.ok ? 'admin-msg-ok' : 'auth-error'}>{apiKeyMsg.text}</p>}
                    <button type="submit" className="auth-submit liquid-btn" disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </form>
                )}
              </div>

              <div className="settings-card liquid-card">
                <h2 className="settings-card-title">Revenue</h2>
                <p className="settings-help">
                  Set your default revenue per booking (used when a booking has no value). You can view and change these anytime.
                </p>
                {loading ? (
                  <p className="admin-muted">Loading…</p>
                ) : (
                  <form onSubmit={handleRevenueSubmit} className="settings-form">
                    <label className="settings-field">
                      <span className="auth-label">Default revenue per booking ($)</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="auth-input"
                        value={revenue.defaultRevenuePerBooking}
                        onChange={(e) => setRevenue((r) => ({ ...r, defaultRevenuePerBooking: e.target.value }))}
                        placeholder="e.g. 150"
                      />
                    </label>
                    <label className="settings-field">
                      <span className="auth-label">Currency</span>
                      <input
                        type="text"
                        className="auth-input"
                        value={revenue.currency}
                        onChange={(e) => setRevenue((r) => ({ ...r, currency: e.target.value }))}
                        placeholder="USD"
                      />
                    </label>
                    {revenueMsg && <p className={revenueMsg.ok ? 'admin-msg-ok' : 'auth-error'}>{revenueMsg.text}</p>}
                    <button type="submit" className="auth-submit liquid-btn" disabled={revenueSaving}>
                      {revenueSaving ? 'Saving…' : 'Save revenue settings'}
                    </button>
                  </form>
                )}
              </div>
            </main>
          </div>
        </DemoSessionProvider>
      </SessionGuard>
    </SessionProvider>
  )
}
