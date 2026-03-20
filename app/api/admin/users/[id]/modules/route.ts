import { NextRequest, NextResponse } from 'next/server'
import { parseSessionCookie, SESSION_COOKIE } from '@/lib/auth'
import { updateUserModules, getUserById, MODULE_IDS, type ModuleId } from '@/lib/userStore'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = parseSessionCookie(cookie)
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const user = await getUserById(id)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await request.json()
  const { modules } = body
  if (!Array.isArray(modules)) {
    return NextResponse.json({ error: 'modules must be an array' }, { status: 400 })
  }

  const validModules = (modules as string[]).filter(
    (m): m is ModuleId => MODULE_IDS.includes(m as ModuleId)
  )

  const updated = await updateUserModules(id, validModules)
  return NextResponse.json({
    user: {
      id: updated!.id,
      email: updated!.email,
      allowedModules: updated!.allowedModules ?? [],
    },
  })
}
