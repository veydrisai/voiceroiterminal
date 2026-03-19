'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { useDemoSession } from './DemoSessionProvider'
import { getModulesForNav } from '@/lib/moduleConfig'

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export default function Sidebar() {
  const pathname = usePathname()
  const { session, logout, isLoggingOut } = useSession()
  const { connectDashboard, connectStatus, backendError } = useDemoSession()
  const modules = getModulesForNav(session?.allowedModules, session?.role === 'admin')

  return (
    <aside className="terminal-sidebar">
      <div className="terminal-logo">
        <img src="/logo.svg" alt="CaptureOS" className="terminal-logo-img" />
        <div>
          <div className="terminal-logo-name">CaptureOS</div>
          <div className="terminal-logo-sub">revenuecs.com</div>
        </div>
      </div>
      {session && (
        <div className="sidebar-user">
          <span className="sidebar-user-email">{session.email}</span>
          <button type="button" className="session-pill" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      )}
      <div className="api-card">
        <h3>API Session</h3>
        <p className="api-session-help">
          Connects your dashboard to your voice/CRM backend. Configure in Settings.
        </p>
        <button type="button" className="connect-btn" onClick={connectDashboard} disabled={connectStatus === 'connecting'}>
          {connectStatus === 'connecting' ? 'Connecting...' : 'Connect Dashboard'}
        </button>
        {connectStatus === 'connecting' && (
          <p className="connect-status">Connecting to backend...</p>
        )}
        {connectStatus === 'connected' && (
          <p className="connect-status connected">Connected</p>
        )}
        {connectStatus === 'unavailable' && (
          <p className="connect-status" role="alert">
            {backendError || 'Backend unavailable. Log in and try Connect again.'}
          </p>
        )}
      </div>

      <div className="modules-title">Available Modules</div>
      <nav className="sidebar-nav-group" role="navigation" aria-label="Modules">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`sidebar-nav-link ${isActive(pathname, m.href) ? 'active' : ''}`}
          >
            {m.label}
          </Link>
        ))}
      </nav>

      <div className="modules-title">Account</div>
      <nav className="sidebar-nav-group">
        <Link href="/settings" className={`sidebar-nav-link ${pathname === '/settings' ? 'active' : ''}`}>
          Settings
        </Link>
        {session?.role === 'admin' && (
          <Link href="/admin" className={`sidebar-nav-link ${pathname === '/admin' ? 'active' : ''}`}>
            Admin
          </Link>
        )}
      </nav>

      <div className="sidebar-badge">System Integrity</div>
    </aside>
  )
}
