'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import '@/app/login/login.css'
import '@/app/onboarding/onboarding.css'

const STEPS = [
  { id: 'welcome', title: 'Welcome', fields: [] },
  { id: 'twilio', title: 'Twilio', fields: ['twilioAccountSid', 'twilioAuthToken'] },
  { id: 'vapi', title: 'Vapi & Make.com', fields: ['vapiApiKey', 'crmEndpoint', 'webhookSecret'] },
  { id: 'revenue', title: 'Revenue', fields: ['defaultRevenuePerBooking'] },
  { id: 'done', title: "You're set", fields: [] },
]

const FIELD_LABELS: Record<string, string> = {
  twilioAccountSid: 'Twilio Account SID',
  twilioAuthToken: 'Twilio Auth Token',
  vapiApiKey: 'Vapi API Key',
  crmEndpoint: 'Make.com webhook target URL (optional)',
  webhookSecret: 'Webhook secret (optional)',
  defaultRevenuePerBooking: 'Default revenue per booking ($)',
}


export default function OnboardingPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [revenuePerBooking, setRevenuePerBooking] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/users/api-keys', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => data.keys && setKeys(data.keys))
      .catch(() => {})
  }, [])

  const step = STEPS[stepIndex]!
  const isLast = stepIndex === STEPS.length - 1
  const isFirst = stepIndex === 0

  async function next() {
    if (isLast) {
      setSaving(true)
      try {
        const res = await fetch('/api/users/onboarding', { method: 'PATCH', credentials: 'include' })
        if (!res.ok) {
          setSaving(false)
          return
        }
        router.push('/dashboard')
        router.refresh()
      } catch {
        setSaving(false)
      }
      return
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  return (
    <div className="auth-shell">
      <div className="auth-bg" />
      <div className="onboarding-card liquid-card">
        <div className="onboarding-progress">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`onboarding-dot ${i <= stepIndex ? 'active' : ''}`}
              aria-hidden
            />
          ))}
        </div>

        {step.id === 'welcome' && (
          <div className="onboarding-step">
            <h1 className="auth-title">Set up your account</h1>
            <p className="onboarding-p">
              We’ll walk you through connecting your API keys and endpoints. You can change these anytime in Settings.
            </p>
          </div>
        )}

        {step.id === 'twilio' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Twilio</h2>
            <p className="onboarding-p">Add your Twilio credentials (Account SID & Auth Token from console.twilio.com).</p>
            {step.fields.map((f) => (
              <label key={f} className="onboarding-field">
                <span className="auth-label">{FIELD_LABELS[f] ?? f}</span>
                <input
                  type={f.includes('Token') || f.includes('Secret') ? 'password' : 'text'}
                  className="auth-input"
                  value={keys[f] ?? ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [f]: e.target.value }))}
                  placeholder={f.includes('SID') ? 'AC…' : ''}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
        )}

        {step.id === 'vapi' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Vapi & Make.com</h2>
            <p className="onboarding-p">Vapi API key from dashboard.vapi.ai. For Make.com, use your webhook URL when building scenarios.</p>
            {step.fields.map((f) => (
              <label key={f} className="onboarding-field">
                <span className="auth-label">{FIELD_LABELS[f] ?? f}</span>
                <input
                  type={f === 'webhookSecret' || f === 'vapiApiKey' ? 'password' : 'text'}
                  className="auth-input"
                  value={keys[f] ?? ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [f]: e.target.value }))}
                  placeholder={f === 'crmEndpoint' ? 'https://your-app.com/api/webhooks/make' : ''}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
        )}

        {step.id === 'revenue' && (
          <div className="onboarding-step">
            <h2 className="onboarding-step-title">Revenue Tracking</h2>
            <p className="onboarding-p">What is your average revenue per booked appointment? This drives your ROI dashboard calculations.</p>
            <label className="onboarding-field">
              <span className="auth-label">{FIELD_LABELS['defaultRevenuePerBooking']}</span>
              <input
                type="number"
                className="auth-input"
                value={revenuePerBooking}
                onChange={(e) => setRevenuePerBooking(e.target.value)}
                placeholder="150"
                min="0"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="onboarding-back liquid-btn"
              style={{ marginTop: '8px', fontSize: '13px', opacity: 0.6 }}
              onClick={() => setStepIndex((i) => i + 1)}
            >
              Skip for now
            </button>
          </div>
        )}

        {step.id === 'done' && (
          <div className="onboarding-step">
            <h1 className="auth-title">All set</h1>
            <p className="onboarding-p">Your API keys are saved. You can update them in Settings anytime.</p>
          </div>
        )}

        <div className="onboarding-actions">
          {!isFirst && (
            <button type="button" className="onboarding-back liquid-btn" onClick={back}>
              Back
            </button>
          )}
          <button
            type="button"
            className="auth-submit liquid-btn"
            onClick={async () => {
              if (step.id === 'revenue' && revenuePerBooking) {
                setSaving(true)
                await fetch('/api/users/revenue-settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ defaultRevenuePerBooking: parseFloat(revenuePerBooking) }),
                }).catch(() => {})
                setSaving(false)
              } else if (step.fields.length > 0) {
                setSaving(true)
                await fetch('/api/users/api-keys', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify(keys),
                })
                setSaving(false)
              }
              next()
            }}
            disabled={saving}
          >
            {saving ? 'Saving…' : isLast ? 'Go to dashboard' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
