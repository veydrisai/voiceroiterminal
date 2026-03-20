import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { createUser, listClients, MODULE_IDS, type ModuleId } from '@/lib/userStore'

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const clients = (await listClients()).map((u) => ({
    id: u.id,
    email: u.email,
    onboardingComplete: u.onboardingComplete,
    allowedModules: u.allowedModules ?? [],
    createdAt: u.createdAt,
  }))
  return NextResponse.json({ clients })
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { email, password, modules } = body
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    const allowedModules = Array.isArray(modules) && modules.length > 0
      ? (modules as string[]).filter((m): m is ModuleId => MODULE_IDS.includes(m as ModuleId))
      : undefined
    const user = await createUser({ email, password, role: 'client', allowedModules })
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        onboardingComplete: user.onboardingComplete,
        allowedModules: user.allowedModules ?? [],
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
