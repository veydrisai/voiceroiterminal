'use client'

import Link from 'next/link'
import { useDemoSession } from '@/components/terminal/DemoSessionProvider'

export default function SystemPage() {
  const { connectStatus, lastSync, backendError } = useDemoSession()

  const dbStatus = connectStatus === 'connected'
    ? { label: 'Connected', ok: true }
    : connectStatus === 'connecting'
    ? { label: 'Connecting…', ok: null }
    : connectStatus === 'unavailable'
    ? { label: 'Unavailable', ok: false }
    : { label: 'Not connected', ok: null }

  return (
    <div className="module-page">
      <header className="module-header">
        <h1 className="module-title">System</h1>
        <p className="module-subtitle">Connection status and configuration</p>
      </header>

      <div className="ios-card section-card">
        <h2 className="section-title">Status</h2>
        <ul className="ios-list">
          <li>
            <span>Dashboard</span>
            <span className={`ios-list-badge${dbStatus.ok === true ? ' status-ok' : dbStatus.ok === false ? ' ios-list-badge-err' : ''}`}>
              {dbStatus.label}
            </span>
          </li>
          <li>
            <span>Last sync</span>
            <span className="ios-list-value">{lastSync}</span>
          </li>
          {backendError && (
            <li style={{ display: 'block' }}>
              <span className="auth-error" style={{ fontSize: 12 }}>{backendError}</span>
            </li>
          )}
        </ul>
      </div>

      <div className="ios-card section-card">
        <h2 className="section-title">Quick actions</h2>
        <ul className="ios-list">
          <li><Link href="/settings" className="ios-list-link">API keys &amp; integrations</Link></li>
        </ul>
      </div>

      <div className="ios-card section-card">
        <h2 className="section-title">About</h2>
        <p className="section-description" style={{ marginBottom: 0 }}>VoiceROI Terminal</p>
      </div>
    </div>
  )
}
