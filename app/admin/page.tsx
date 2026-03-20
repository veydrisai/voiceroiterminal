'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import '@/app/dashboard/terminal.css'
import '@/app/admin/admin.css'
import { SessionProvider } from '@/contexts/SessionContext'
import { DemoSessionProvider } from '@/components/terminal/DemoSessionProvider'
import { SessionGuard } from '@/components/terminal/SessionGuard'
import Sidebar from '@/components/terminal/Sidebar'
import { MODULES_NAV, DEFAULT_CLIENT_MODULES } from '@/lib/moduleConfig'

type Client = { id: string; email: string; onboardingComplete: boolean; allowedModules?: string[]; createdAt: string }
type RevenueSettings = { defaultRevenuePerBooking?: number; currency?: string }
type ClientCredentials = {
  twilioAccountSid: string; twilioAuthToken: string
  vapiApiKey: string; crmEndpoint: string; webhookSecret: string
}
type Conversation = {
  id: string; time: string; caller: string; intent: string; outcome: string
  revenue: number; durationSec: number; rawIntent: string; rawOutcome: string
}

export default function AdminPage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modules, setModules] = useState<string[]>(() => [...DEFAULT_CLIENT_MODULES])
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [revenueDefault, setRevenueDefault] = useState('')
  const [revenueCurrency, setRevenueCurrency] = useState('USD')
  const [revenueSaving, setRevenueSaving] = useState(false)
  const [revenueMessage, setRevenueMessage] = useState<string | null>(null)
  const [pipelineClientId, setPipelineClientId] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [setupClientId, setSetupClientId] = useState('')
  const [setupCreds, setSetupCreds] = useState<ClientCredentials>({ twilioAccountSid: '', twilioAuthToken: '', vapiApiKey: '', crmEndpoint: '', webhookSecret: '' })
  const [setupRevenue, setSetupRevenue] = useState('')
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupMessage, setSetupMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [editingConv, setEditingConv] = useState<Conversation | null>(null)
  const [editForm, setEditForm] = useState({ intent: '', outcome: '', revenue: 0 })
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function toggleModule(id: string) {
    setModules((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  function loadSetupClient(clientId: string) {
    setSetupClientId(clientId)
    setSetupMessage(null)
    setSetupCreds({ twilioAccountSid: '', twilioAuthToken: '', vapiApiKey: '', crmEndpoint: '', webhookSecret: '' })
    setSetupRevenue('')
    if (!clientId) return
    fetch(`/api/admin/clients/${clientId}/credentials`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.credentials) setSetupCreds((prev) => ({ ...prev, ...data.credentials })) })
      .catch(() => {})
    fetch(`/api/admin/clients/${clientId}/revenue-settings`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (data.settings?.defaultRevenuePerBooking != null) setSetupRevenue(String(data.settings.defaultRevenuePerBooking)) })
      .catch(() => {})
  }

  async function handleSetupClient(e: React.FormEvent) {
    e.preventDefault()
    if (!setupClientId) return
    setSetupSaving(true)
    setSetupMessage(null)
    try {
      const [credsRes, revenueRes] = await Promise.all([
        fetch(`/api/admin/clients/${setupClientId}/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(setupCreds),
        }),
        setupRevenue ? fetch(`/api/admin/clients/${setupClientId}/revenue-settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ defaultRevenuePerBooking: Number(setupRevenue) }),
        }) : Promise.resolve({ ok: true }),
      ])
      if (!credsRes.ok || !revenueRes.ok) {
        setSetupMessage({ ok: false, text: 'Failed to save — check all fields.' })
        return
      }
      // Mark onboarding complete so client logs in directly to dashboard
      await fetch(`/api/admin/clients/${setupClientId}/complete-setup`, { method: 'POST', credentials: 'include' })
      setClients((prev) => prev.map((c) => c.id === setupClientId ? { ...c, onboardingComplete: true } : c))
      setSetupMessage({ ok: true, text: 'Client is fully configured and ready. They can log in directly to the dashboard.' })
    } catch {
      setSetupMessage({ ok: false, text: 'Something went wrong' })
    } finally {
      setSetupSaving(false)
    }
  }

  function loadClientRevenue(clientId: string) {
    setSelectedClientId(clientId)
    setRevenueMessage(null)
    if (!clientId) { setRevenueDefault(''); setRevenueCurrency('USD'); return }
    fetch(`/api/admin/clients/${clientId}/revenue-settings`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { settings?: RevenueSettings }) => {
        const s = data?.settings
        setRevenueDefault(s?.defaultRevenuePerBooking != null ? String(s.defaultRevenuePerBooking) : '')
        setRevenueCurrency(s?.currency ?? 'USD')
      })
      .catch(() => setRevenueMessage('Failed to load'))
  }

  async function handleSaveClientRevenue(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClientId) return
    setRevenueMessage(null)
    setRevenueSaving(true)
    try {
      const res = await fetch(`/api/admin/clients/${selectedClientId}/revenue-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          defaultRevenuePerBooking: revenueDefault === '' ? undefined : Number(revenueDefault),
          currency: revenueCurrency || undefined,
        }),
      })
      const data = await res.json()
      setRevenueMessage(!res.ok ? (data?.error || 'Failed to save') : 'Revenue settings saved for this client.')
    } catch {
      setRevenueMessage('Something went wrong')
    } finally {
      setRevenueSaving(false)
    }
  }

  function loadClientPipeline(clientId: string) {
    setPipelineClientId(clientId)
    setConversations([])
    if (!clientId) return
    setPipelineLoading(true)
    fetch(`/api/admin/clients/${clientId}/conversations`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { setConversations(data?.conversations ?? []) })
      .catch(() => {})
      .finally(() => setPipelineLoading(false))
  }

  function openEdit(conv: Conversation) {
    setEditingConv(conv)
    setEditForm({ intent: conv.rawIntent || conv.intent, outcome: conv.rawOutcome || conv.outcome, revenue: conv.revenue })
    setEditMessage(null)
  }

  function closeEdit() { setEditingConv(null); setEditMessage(null) }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingConv || !pipelineClientId) return
    setEditSaving(true)
    setEditMessage(null)
    try {
      const res = await fetch(`/api/admin/clients/${pipelineClientId}/conversations/${editingConv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ intent: editForm.intent, outcome: editForm.outcome, revenue: Number(editForm.revenue) }),
      })
      if (!res.ok) { setEditMessage({ text: 'Failed to save', ok: false }); return }
      setConversations((prev) => prev.map((c) =>
        c.id === editingConv.id
          ? { ...c, rawIntent: editForm.intent, rawOutcome: editForm.outcome, revenue: Number(editForm.revenue), intent: editForm.intent, outcome: editForm.outcome }
          : c
      ))
      setEditMessage({ text: 'Saved.', ok: true })
      setTimeout(closeEdit, 800)
    } catch {
      setEditMessage({ text: 'Something went wrong', ok: false })
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then((r) => { if (r.status === 401) { router.replace('/dashboard'); return null } return r.json() })
      .then((data) => { if (data?.clients) setClients(data.clients); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, modules }),
      })
      const data = await res.json()
      if (!res.ok) { setMessage({ type: 'err', text: data?.error || 'Failed to create user' }); return }
      const user = data?.user
      if (!user) { setMessage({ type: 'err', text: 'Invalid response from server' }); return }
      setMessage({ type: 'ok', text: `Created ${user.email}. Share these credentials with the client.` })
      setEmail('')
      setPassword('')
      setClients((prev) => [...prev, { id: user.id, email: user.email, onboardingComplete: user.onboardingComplete ?? false, allowedModules: user.allowedModules ?? [], createdAt: '' }])
    } catch {
      setMessage({ type: 'err', text: 'Something went wrong' })
    } finally {
      setCreating(false)
    }
  }

  const pipelineClient = clients.find((c) => c.id === pipelineClientId)

  return (
    <SessionProvider>
      <SessionGuard>
        <DemoSessionProvider>
          <div className="terminal">
            <Sidebar />
            <main className="terminal-main admin-main">
              <h1 className="admin-title">Client accounts</h1>
              <p className="admin-desc">Manage clients, revenue settings, and conversation pipelines.</p>

              <div className="admin-card liquid-card">
                <h2 className="admin-card-title">Create new client</h2>
                <form onSubmit={handleCreate} className="admin-form">
                  <label className="auth-label">Client email</label>
                  <input type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" required />
                  <label className="auth-label">Set password</label>
                  <input type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" minLength={6} required />
                  <div className="admin-modules">
                    <span className="auth-label">Packages &amp; modules</span>
                    <p className="admin-modules-hint">Choose which modules this client can access.</p>
                    {MODULES_NAV.map((m) => (
                      <label key={m.id} className="admin-module-check">
                        <input type="checkbox" checked={modules.includes(m.id)} onChange={() => toggleModule(m.id)} />
                        <span>{m.label}</span>
                      </label>
                    ))}
                  </div>
                  {message && <p className={message.type === 'ok' ? 'admin-msg-ok' : 'auth-error'} role="alert">{message.text}</p>}
                  <button type="submit" className="auth-submit liquid-btn" disabled={creating}>{creating ? 'Creating...' : 'Create account'}</button>
                </form>
              </div>

              <div className="admin-card liquid-card">
                <h2 className="admin-card-title">Configure client — instant setup</h2>
                <p className="admin-desc">Select a client, enter their API keys and revenue default, and click Save. They'll skip onboarding and land directly on their dashboard.</p>
                {clients.length === 0 ? <p className="admin-muted">Create a client first.</p> : (
                  <form onSubmit={handleSetupClient} className="admin-form">
                    <label className="auth-label">Client</label>
                    <select className="auth-input" value={setupClientId} onChange={(e) => loadSetupClient(e.target.value)} required>
                      <option value="">Select a client…</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.email}{c.onboardingComplete ? ' ✓' : ''}</option>)}
                    </select>
                    {setupClientId && (
                      <>
                        <p className="auth-label" style={{ marginTop: 16, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em' }}>TWILIO</p>
                        <label className="auth-label">Account SID</label>
                        <input type="text" className="auth-input" value={setupCreds.twilioAccountSid} onChange={(e) => setSetupCreds((c) => ({ ...c, twilioAccountSid: e.target.value }))} placeholder="AC…" autoComplete="off" />
                        <label className="auth-label">Auth Token</label>
                        <input type="password" className="auth-input" value={setupCreds.twilioAuthToken} onChange={(e) => setSetupCreds((c) => ({ ...c, twilioAuthToken: e.target.value }))} placeholder="••••••••" autoComplete="off" />
                        <p className="auth-label" style={{ marginTop: 16, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em' }}>VAPI</p>
                        <label className="auth-label">Vapi API Key</label>
                        <input type="password" className="auth-input" value={setupCreds.vapiApiKey} onChange={(e) => setSetupCreds((c) => ({ ...c, vapiApiKey: e.target.value }))} placeholder="••••••••" autoComplete="off" />
                        <p className="auth-label" style={{ marginTop: 16, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em' }}>MAKE.COM / WEBHOOK</p>
                        <label className="auth-label">Webhook Secret</label>
                        <input type="password" className="auth-input" value={setupCreds.webhookSecret} onChange={(e) => setSetupCreds((c) => ({ ...c, webhookSecret: e.target.value }))} placeholder="••••••••" autoComplete="off" />
                        <label className="auth-label">Make.com target URL (optional)</label>
                        <input type="text" className="auth-input" value={setupCreds.crmEndpoint} onChange={(e) => setSetupCreds((c) => ({ ...c, crmEndpoint: e.target.value }))} placeholder="https://hook.make.com/…" autoComplete="off" />
                        <p className="auth-label" style={{ marginTop: 16, marginBottom: 4, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.08em' }}>REVENUE</p>
                        <label className="auth-label">Default revenue per booking ($)</label>
                        <input type="number" min={0} className="auth-input" value={setupRevenue} onChange={(e) => setSetupRevenue(e.target.value)} placeholder="e.g. 150" />
                        {setupMessage && <p className={setupMessage.ok ? 'admin-msg-ok' : 'auth-error'} role="alert">{setupMessage.text}</p>}
                        <button type="submit" className="auth-submit liquid-btn" disabled={setupSaving}>{setupSaving ? 'Saving…' : 'Save & activate client'}</button>
                      </>
                    )}
                  </form>
                )}
              </div>

              <div className="admin-card liquid-card">
                <h2 className="admin-card-title">Existing clients</h2>
                {loading ? <p className="admin-muted">Loading...</p> : clients.length === 0 ? <p className="admin-muted">No client accounts yet.</p> : (
                  <ul className="admin-list">
                    {clients.map((c) => (
                      <li key={c.id} className="admin-list-item">
                        <span className="admin-list-email">{c.email}</span>
                        <span className={`admin-list-badge ${c.onboardingComplete ? 'done' : 'pending'}`}>{c.onboardingComplete ? 'Onboarded' : 'Pending setup'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="admin-card liquid-card">
                <h2 className="admin-card-title">Manage client pipeline</h2>
                <p className="admin-desc">View and edit any client conversation pipeline. Update revenue, intent, and outcome for each lead without logging into their account.</p>
                {clients.length === 0 ? <p className="admin-muted">Create a client first.</p> : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label className="auth-label">Select client</label>
                      <select className="auth-input" value={pipelineClientId} onChange={(e) => loadClientPipeline(e.target.value)}>
                        <option value="">Select a client...</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
                      </select>
                    </div>
                    {pipelineClientId && (
                      <>
                        <p className="admin-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                          {pipelineLoading ? 'Loading...' : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} for ${pipelineClient?.email ?? ''}`}
                        </p>
                        {!pipelineLoading && conversations.length === 0 ? (
                          <p className="admin-muted">No conversations yet for this client.</p>
                        ) : (
                          <div className="pipeline-table-wrap" style={{ maxHeight: 400 }}>
                            <table className="pipeline-table">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>Caller</th>
                                  <th>Intent</th>
                                  <th>Outcome</th>
                                  <th>Revenue</th>
                                  <th className="pipeline-th-actions">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {conversations.map((conv) => (
                                  <tr key={conv.id}>
                                    <td>{conv.time}</td>
                                    <td>{conv.caller}</td>
                                    <td>{conv.intent}</td>
                                    <td>{conv.outcome}</td>
                                    <td>${conv.revenue.toLocaleString()}</td>
                                    <td className="pipeline-td-actions">
                                      <button type="button" className="pipeline-edit-btn" onClick={() => openEdit(conv)}>Edit</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="admin-card liquid-card">
                <h2 className="admin-card-title">Manage client revenue defaults</h2>
                <p className="admin-desc">Set default revenue per booking per client.</p>
                {clients.length === 0 ? <p className="admin-muted">Create a client first.</p> : (
                  <form onSubmit={handleSaveClientRevenue} className="admin-form">
                    <label className="auth-label">Client</label>
                    <select className="auth-input" value={selectedClientId} onChange={(e) => loadClientRevenue(e.target.value)}>
                      <option value="">Select a client...</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.email}</option>)}
                    </select>
                    {selectedClientId && (
                      <>
                        <label className="auth-label">Default revenue per booking ($)</label>
                        <input type="number" min={0} step={1} className="auth-input" value={revenueDefault} onChange={(e) => setRevenueDefault(e.target.value)} placeholder="e.g. 150" />
                        <label className="auth-label">Currency</label>
                        <input type="text" className="auth-input" value={revenueCurrency} onChange={(e) => setRevenueCurrency(e.target.value)} placeholder="USD" />
                        {revenueMessage && <p className={revenueMessage.startsWith('Revenue') ? 'admin-msg-ok' : 'auth-error'} role="alert">{revenueMessage}</p>}
                        <button type="submit" className="auth-submit liquid-btn" disabled={revenueSaving}>{revenueSaving ? 'Saving...' : 'Save revenue for this client'}</button>
                      </>
                    )}
                  </form>
                )}
              </div>
            </main>
          </div>

          {editingConv && typeof document !== 'undefined' && createPortal(
            <div className="pipeline-modal-backdrop pipeline-modal-backdrop-top" onClick={closeEdit} aria-hidden>
              <div className="pipeline-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pipeline-modal-header">
                  <h3 className="pipeline-modal-title">Edit lead</h3>
                  <p className="pipeline-modal-desc">{editingConv.caller} &middot; {editingConv.time}</p>
                </div>
                <form onSubmit={handleSaveEdit}>
                  <div className="pipeline-modal-form">
                    <label className="pipeline-modal-field">
                      <span className="pipeline-modal-label">Intent</span>
                      <input type="text" className="pipeline-modal-input" value={editForm.intent} onChange={(e) => setEditForm((f) => ({ ...f, intent: e.target.value }))} placeholder="e.g. Booked, Inquiry" />
                    </label>
                    <label className="pipeline-modal-field">
                      <span className="pipeline-modal-label">Outcome</span>
                      <input type="text" className="pipeline-modal-input" value={editForm.outcome} onChange={(e) => setEditForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="e.g. Booked, Callback" />
                    </label>
                    <label className="pipeline-modal-field">
                      <span className="pipeline-modal-label">Revenue ($)</span>
                      <input type="number" min={0} step={1} className="pipeline-modal-input" value={editForm.revenue} onChange={(e) => setEditForm((f) => ({ ...f, revenue: e.target.value === '' ? 0 : Number(e.target.value) }))} placeholder="0" />
                    </label>
                    {editMessage && <p className={editMessage.ok ? 'admin-msg-ok' : 'auth-error'} style={{ margin: 0 }}>{editMessage.text}</p>}
                  </div>
                  <div className="pipeline-modal-buttons">
                    <button type="button" className="pipeline-modal-cancel" onClick={closeEdit}>Cancel</button>
                    <button type="submit" className="pipeline-modal-save" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save'}</button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
        </DemoSessionProvider>
      </SessionGuard>
    </SessionProvider>
  )
}
