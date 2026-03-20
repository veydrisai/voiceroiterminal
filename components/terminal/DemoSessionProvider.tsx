'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  initialKPIs,
  emptyRevenueSeries,
  emptyPipeline,
  defaultLastSync,
  type KPIs,
  type RevenuePoint,
  type PipelineRow,
} from '@/lib/demoData'

type ConnectStatus = 'idle' | 'connecting' | 'connected' | 'unavailable'

type DemoSessionState = {
  loggedIn: boolean
  kpis: KPIs
  revenueSeries: RevenuePoint[]
  pipelineRows: PipelineRow[]
  lastSync: string
  connectStatus: ConnectStatus
  backendError: string | null
}

type DemoSessionContextValue = DemoSessionState & {
  setLoggedIn: (value: boolean) => void
  connectDashboard: () => void
  refreshData: () => void
  updatePipelineRow: (id: string, updates: Partial<Omit<PipelineRow, 'id'>>) => void
}

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null)

type FetchResult =
  | { ok: true; kpis: KPIs; pipelineRows: PipelineRow[]; lastSync: string }
  | { ok: false; status: number; message: string }

const HINT_MESSAGES: Record<string, string> = {
  not_logged_in: 'Please log in again.',
  db_error: 'Database not configured or error. Check server DATABASE_URL.',
  missing_vapi_key: 'Vapi API key not set. Add it in Settings and save.',
  no_tenant: 'Save your API keys in Settings first.',
  ok: '',
}

async function fetchConnectionHint(): Promise<string | null> {
  try {
    const res = await fetch('/api/debug/connection', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    const hint = data?.hint as string
    return hint && HINT_MESSAGES[hint] ? HINT_MESSAGES[hint] : null
  } catch {
    return null
  }
}

async function fetchDashboardData(): Promise<FetchResult> {
  try {
    const res = await fetch('/api/dashboard/data', { credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = (data?.error as string) || (res.status === 401 ? 'Please log in again' : `Request failed (${res.status})`)
      return { ok: false, status: res.status, message }
    }
    return {
      ok: true,
      kpis: data.kpis ?? initialKPIs,
      pipelineRows: Array.isArray(data.pipelineRows) ? data.pipelineRows : emptyPipeline,
      lastSync: data.lastSync ?? defaultLastSync,
    }
  } catch {
    return { ok: false, status: 0, message: 'Network error — check your connection' }
  }
}

export function DemoSessionProvider({ children, initialLoggedIn = false }: { children: React.ReactNode; initialLoggedIn?: boolean }) {
  const [state, setState] = useState<DemoSessionState>({
    loggedIn: initialLoggedIn,
    kpis: initialKPIs,
    revenueSeries: emptyRevenueSeries,
    pipelineRows: emptyPipeline,
    lastSync: defaultLastSync,
    connectStatus: 'idle',
    backendError: null,
  })

  const loadDashboardData = useCallback(async (setStatus = true) => {
    if (setStatus) setState((prev) => ({ ...prev, connectStatus: 'connecting', backendError: null }))
    const result = await fetchDashboardData()
    if (result.ok) {
      setState((prev) => ({
        ...prev,
        kpis: result.kpis,
        pipelineRows: result.pipelineRows,
        lastSync: result.lastSync,
        ...(setStatus && { connectStatus: 'connected' as const, backendError: null }),
      }))
    } else if (setStatus) {
      const hintMessage = await fetchConnectionHint()
      setState((prev) => ({
        ...prev,
        connectStatus: 'unavailable',
        backendError: hintMessage || result.message,
      }))
    }
  }, [])

  useEffect(() => {
    if (state.loggedIn) loadDashboardData(true)
  }, [state.loggedIn, loadDashboardData])

  const setLoggedIn = useCallback((value: boolean) => {
    setState((prev) => {
      if (value) return { ...prev, loggedIn: true }
      return {
        loggedIn: false,
        kpis: initialKPIs,
        revenueSeries: emptyRevenueSeries,
        pipelineRows: emptyPipeline,
        lastSync: defaultLastSync,
        connectStatus: 'idle',
        backendError: null,
      }
    })
  }, [])

  const connectDashboard = useCallback(() => {
    setState((prev) => ({ ...prev, loggedIn: true }))
    loadDashboardData(true)
  }, [loadDashboardData])

  const refreshData = useCallback(async () => {
    setState((prev) => ({ ...prev, connectStatus: 'connecting', backendError: null }))
    const result = await fetchDashboardData()
    if (result.ok) {
      setState((prev) => ({
        ...prev,
        kpis: result.kpis,
        pipelineRows: result.pipelineRows,
        lastSync: result.lastSync,
        connectStatus: 'connected',
        backendError: null,
      }))
    } else {
      const hintMessage = await fetchConnectionHint()
      setState((prev) => ({
        ...prev,
        connectStatus: 'unavailable',
        backendError: hintMessage || result.message,
      }))
    }
  }, [])

  const updatePipelineRow = useCallback((id: string, updates: Partial<Omit<PipelineRow, 'id'>>) => {
    setState((prev) => ({
      ...prev,
      pipelineRows: prev.pipelineRows.map((row, index) => {
        const rowId = row.id ?? `legacy_${index}`
        return rowId === id ? { ...row, id: row.id ?? id, ...updates } : row
      }),
    }))

    if (!id.startsWith('legacy_') && (updates.intent !== undefined || updates.outcome !== undefined || updates.revenue !== undefined)) {
      fetch(`/api/dashboard/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          intent: updates.intent,
          outcome: updates.outcome,
          revenue: updates.revenue,
        }),
      }).catch((err) => {
        console.error('Failed to update pipeline row:', err);
        // re-throw so callers can handle it
        throw err;
      })
    }
  }, [])

  const value: DemoSessionContextValue = {
    ...state,
    setLoggedIn,
    connectDashboard,
    refreshData,
    updatePipelineRow,
  }

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  )
}

export function useDemoSession() {
  const ctx = useContext(DemoSessionContext)
  if (!ctx) throw new Error('useDemoSession must be used within DemoSessionProvider')
  return ctx
}
