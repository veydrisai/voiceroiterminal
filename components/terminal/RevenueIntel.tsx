'use client'

import { useState, useEffect, useRef } from 'react'
import { useDemoSession } from './DemoSessionProvider'

export default function RevenueIntel() {
  const { connectStatus } = useDemoSession()
  const [insights, setInsights] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (connectStatus !== 'connected' || loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch('/api/ai/insights', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setInsights(data.insights ?? data.error ?? 'No insights available.')
      })
      .catch(() => setInsights('Unable to load insights. Check your connection.'))
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
      setAnswer(data.answer ?? data.error ?? 'No answer returned.')
    } catch {
      setAnswer('Unable to get an answer. Try again.')
    } finally {
      setChatLoading(false)
    }
  }

  if (connectStatus !== 'connected' && connectStatus !== 'connecting') return null

  return (
    <div className="ri-panel">
      {/* Ambient glow orbs */}
      <div className="ri-orb ri-orb-1" />
      <div className="ri-orb ri-orb-2" />

      {/* Header */}
      <div className="ri-header">
        <div className="ri-header-left">
          <div className="ri-icon-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="ri-title">REVENUE INTEL</span>
        </div>
        <div className="ri-badge">AI</div>
      </div>

      {/* Divider */}
      <div className="ri-divider" />

      {/* Insights body */}
      <div className="ri-insights-area">
        {(loading || connectStatus === 'connecting') && (
          <div className="ri-skeleton-wrap">
            <div className="ri-skeleton" style={{ width: '92%' }} />
            <div className="ri-skeleton" style={{ width: '78%' }} />
            <div className="ri-skeleton" style={{ width: '85%' }} />
          </div>
        )}
        {!loading && insights && (
          <div className="ri-insights-text">
            {insights.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="ri-insight-line" style={{ animationDelay: `${i * 80}ms` }}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Chat input */}
      <div className={`ri-chat-row${inputFocused ? ' ri-chat-focused' : ''}`}>
        <input
          className="ri-input"
          placeholder="Ask about your performance…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          maxLength={500}
          disabled={chatLoading}
        />
        <button
          className={`ri-send-btn${chatLoading ? ' ri-send-loading' : ''}`}
          onClick={handleAsk}
          disabled={chatLoading || !question.trim()}
          aria-label="Send"
        >
          {chatLoading ? (
            <span className="ri-spinner" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Answer */}
      {answer && (
        <div className="ri-answer">
          <div className="ri-answer-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.15" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <div className="ri-answer-text">
            {answer.split('\n').filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
