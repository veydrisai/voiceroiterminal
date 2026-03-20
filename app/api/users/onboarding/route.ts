import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, createSessionCookie, getSessionCookieSpec, SESSION_COOKIE } from '@/lib/auth'
import { setOnboardingComplete, getUserById, getAllowedModules } from '@/lib/userStore'

export async function PATCH(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await setOnboardingComplete(session.userId)
  const user = await getUserById(session.userId)
  const allowedModules = user ? getAllowedModules(user) : (session.allowedModules ?? [])
  const payload = {
    userId: session.userId,
    email: session.email,
    role: session.role,
    onboardingComplete: true,
    allowedModules: allowedModules as string[],
  }
  const cookieValue = createSessionCookie(payload)
  const spec = getSessionCookieSpec()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(spec.name, cookieValue, {
    maxAge: spec.maxAge,
    httpOnly: spec.httpOnly,
    secure: spec.secure,
    sameSite: spec.sameSite,
    path: spec.path,
  })
  return res
}
