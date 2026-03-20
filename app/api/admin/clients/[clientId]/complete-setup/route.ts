import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { getUserById, setOnboardingComplete } from '@/lib/userStore'
import { getSql } from '@/lib/db'

type RouteParams = { clientId: string }

async function resolveParams(params: RouteParams | Promise<RouteParams>): Promise<RouteParams> {
  return typeof (params as Promise<RouteParams>).then === 'function'
    ? await (params as Promise<RouteParams>)
    : (params as RouteParams)
}

export async function POST(
  request: NextRequest,
  context: { params: RouteParams | Promise<RouteParams> }
) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { clientId } = await resolveParams(context.params)
  const user = await getUserById(clientId)
  if (!user) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  await setOnboardingComplete(clientId)

  // Also update tenant onboarding_complete
  const sql = getSql()
  await sql`UPDATE tenants SET onboarding_complete = true, updated_at = now() WHERE user_id = ${clientId}`

  return NextResponse.json({ ok: true })
}
