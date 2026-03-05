'use client'

import { useState, useEffect } from 'react'

type AnalyticsData = {
  total: number
  avgDuration: string
  byOutcome: { outcome: string; count: number; pct: number }[]
  topIntents: { intent: string; count: number }[]
}

export default function ConversationAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    fetch(`/api/dashboard/analytics?range=${range}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setFetchError('Failed to load analytics data.'); setLoading(false) })
  }, [range])

  const hasData = (data?.total ?? 0) > 0 || (data?.byOutcome?.length ?? 0) > 0 || (data?.topIntents?.length ?? 0) > 0

  return (
    <div className="module-page">
      <header className="module-header">
        <h1 className="module-title">Conversation Analytics</h1>
        <p className="module-subtitle">Insights from call and conversation data</p>
        <div className="module-toolbar">
          <div className="segment-control">
            <button type="button" className={range === '7d' ? 'segment-active' : ''} onClick={() => setRange('7d')}>7 days</button>
            <button type="button" className={range === '30d' ? 'segment-active' : ''} onClick={() => setRange('30d')}>30 days</button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="analytics-loading">
          <div className="cards-row">
            {[0,1,2].map(i => <div key={i} className="ios-card skeleton-card" />)}
          </div>
          <div className="ios-card section-card skeleton-card" style={{ height: 120 }} />
        </div>
      ) : fetchError ? (
        <div className="ios-card section-card" style={{ padding: 24 }}>
          <p className="auth-error" style={{ margin: 0 }}>{fetchError}</p>
        </div>
      ) : !hasData ? (
        <div className="ios-card section-card" style={{ padding: 24 }}>
          <p className="section-description" style={{ margin: 0, color: 'var(--text-muted)' }}>
            No analytics data yet. Add your Vapi API key in Settings, then use Sync from Vapi on the dashboard to import calls.
          </p>
        </div>
      ) : (
        <>
          <div className="cards-row">
            <div className="ios-card">
              <div className="ios-card-label">Total conversations</div>
              <div className="ios-card-value">{(data?.total ?? 0).toLocaleString()}</div>
            </div>
            <div className="ios-card">
              <div className="ios-card-label">Avg. duration</div>
              <div className="ios-card-value">{data?.avgDuration ?? '0:00'}</div>
            </div>
            <div className="ios-card accent">
              <div className="ios-card-label">Outcomes tracked</div>
              <div className="ios-card-value">{data?.byOutcome?.length ?? 0}</div>
            </div>
          </div>

          {(data?.byOutcome?.length ?? 0) > 0 && (
            <div className="ios-card section-card">
              <h2 className="section-title">Conversation breakdown by outcome</h2>
              <p className="section-description">Share of conversations by result for the selected period.</p>
              <ul className="ios-list outcome-list">
                {data!.byOutcome.map((row) => (
                  <li key={row.outcome}>
                    <div className="outcome-row">
                      <span>{row.outcome}</span>
                      <span className="ios-list-value">{row.count} ({row.pct}%)</span>
                    </div>
                    <div className="outcome-bar-wrap">
                      <div className="outcome-bar" style={{ width: `${row.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data?.topIntents?.length ?? 0) > 0 && (
            <div className="ios-card section-card">
              <h2 className="section-title">Top intents</h2>
              <ul className="ios-list">
                {data!.topIntents.map((row) => (
                  <li key={row.intent}>
                    <span>{row.intent}</span>
                    <span className="ios-list-value">{row.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
