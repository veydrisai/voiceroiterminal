import { test, expect } from '@playwright/test'

// NOTE: The login API is validated by the auth setup (auth.setup.ts) which
// must succeed for the authenticated tests to run. These tests cover
// error paths and the middleware redirect behaviour.

test.describe('Auth flows — login error paths', () => {
  // The server uses an in-memory rate limiter (5 attempts per 15 min per IP).
  // In CI all requests share the same "unknown" IP, so we allow 429 as a
  // valid rejection alongside 401 — both mean the request was denied.
  test('login with wrong password is rejected (401 or 429)', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'michael@revenuecs.com', password: 'wrongpassword' },
    })
    expect([401, 429]).toContain(res.status())
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('login with unknown email is rejected (401 or 429)', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nobody@example.com', password: 'somepassword' },
    })
    expect([401, 429]).toContain(res.status())
  })
})

// These middleware redirect tests must run WITHOUT any session cookie.
// test.use({ storageState }) overrides the project-level storageState for this describe.
test.describe('Auth flows — middleware redirects (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated visit to /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated visit to /settings redirects to /login', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})
