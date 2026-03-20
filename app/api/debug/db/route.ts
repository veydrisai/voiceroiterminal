import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  // original debug logic here if needed in dev
  return NextResponse.json({ message: 'Debug endpoint (dev only)' })
}
