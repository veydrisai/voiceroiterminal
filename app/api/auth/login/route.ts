import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'
import { getUserByEmail, getAllowedModules, ensureAdminExists } from '@/lib/userStore'
import { createSessionCookie, getSessionCookieSpec } from '@/lib/auth'

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many login attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    // Ensure admin account exists in DB (idempotent)
    await ensureAdminExists()

    const body = await request.json()
    const { email, password } = body
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }
    const user = await getUserByEmail(email)
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    const allowedModules = getAllowedModules(user)
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
      allowedModules: allowedModules as string[],
    }
    const cookieValue = createSessionCookie(payload)
    const spec = getSessionCookieSpec()
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role, onboardingComplete: user.onboardingComplete, allowedModules },
    })
    res.cookies.set(spec.name, cookieValue, {
      maxAge: spec.maxAge,
      httpOnly: spec.httpOnly,
      secure: spec.secure,
      sameSite: spec.sameSite,
      path: spec.path,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
