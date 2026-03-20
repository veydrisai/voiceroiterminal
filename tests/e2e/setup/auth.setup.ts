import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const authFile = path.join(__dirname, '../.auth/admin.json')

setup('authenticate as admin', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: {
      email: 'michael@revenuecs.com',
      password: 'michaeladmin123',
    },
  })

  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.ok).toBe(true)
  expect(body.user.role).toBe('admin')

  // Extract the Set-Cookie header and build storage state manually
  const headers = response.headers()
  const setCookie = headers['set-cookie'] ?? ''

  // Parse cookie name=value from the Set-Cookie header
  const cookieMatch = setCookie.match(/^([^=]+)=([^;]+)/)
  if (!cookieMatch) {
    throw new Error(`Could not parse Set-Cookie: ${setCookie}`)
  }

  const [, name, value] = cookieMatch

  // Determine cookie attributes
  const secure = /secure/i.test(setCookie)
  const sameSite = setCookie.match(/samesite=(\w+)/i)?.[1] ?? 'Lax'
  const maxAge = parseInt(setCookie.match(/max-age=(\d+)/i)?.[1] ?? '86400', 10)
  const expires = Date.now() / 1000 + maxAge

  const storageState = {
    cookies: [
      {
        name,
        value,
        domain: 'localhost',
        path: '/',
        expires,
        httpOnly: /httponly/i.test(setCookie),
        secure,
        sameSite: (sameSite.charAt(0).toUpperCase() + sameSite.slice(1).toLowerCase()) as 'Lax' | 'Strict' | 'None',
      },
    ],
    origins: [],
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2))

  console.log(`Auth state saved to ${authFile}`)
})
