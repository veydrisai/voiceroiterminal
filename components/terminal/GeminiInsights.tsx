'use client'

import { useState, useEffect, useRef } from 'react'
import { useDemoSession } from './DemoSessionProvider'

export default function GeminiInsights() {
  const { connectStatus } = useDemoSession()
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (connectStatus !== 'connected' || loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch('/api/ai/insights', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.insights) setInsights(data.insights)
        else setError(data.error ?? 'No insights returned')
      })
      .catch(() => setError('Failed to load insights'))
      .finally(() => setLoading(false))
  }, [connectStatus])

  async function handleAsk() {
    if (!question.trim() || chatLoading) return
    setChatLoading(true)
    setAnswer(null)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: question.trim() }),
      })
      const data = await res.json()
      setAnswer(data.answer ?? data.error ?? 'No answer returned')
    } catch {
      setAnswer('Failed to get answer')
    } finally {
      setChatLoading(false)
    }
  }

  if (connectStatus !== 'connected' && connectStatus !== 'connecting') return null

  return (
    <div className="gemini-insights-panel">
      <div className="panel-header">
        <span className="panel-label">AI INSIGHTS</span>
        <span className="gemini-badge">Gemini</span>
      </div>

      <div className="insights-body">
        {loading && <div className="skeleton-pulse insights-skeleton" />}
        {!loading && error && <p className="insights-error">{error}</p>}
        {!loading && insights && (
          <div className="insights-text">
            {insights.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}
      </div>

      <div className="chat-row">
        <input
          className="chat-input"
          placeholder="Ask about your data…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          maxLength={500}
          disabled={chatLoading}
        />
        <button className="chat-send-btn" onClick={handleAsk} disabled={chatLoading || !question.trim()}>
          {chatLoading ? '…' : 'Ask'}
        </button>
      </div>

      {answer && (
        <div className="chat-answer">
          {answer.split('\n').filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
