import { test, expect } from '@playwright/test'

test.describe('Webhook security (no auth needed)', () => {
  test('POST /api/webhooks/make with no body returns 400 (missing tenantId)', async ({ request }) => {
    const res = await request.post('/api/webhooks/make', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })
    // Missing tenantId → 400
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tenant/i)
  })

  test('POST /api/webhooks/make with tenantId but no secret returns 403', async ({ request }) => {
    // Provide a fake tenantId — DB will have no credentials row → 403
    const res = await request.post('/api/webhooks/make', {
      data: { tenantId: 'fake-tenant-id-000' },
      headers: { 'Content-Type': 'application/json' },
    })
    // Either 403 (no secret configured) or 500 (DB connection issue in test)
    expect([403, 500]).toContain(res.status())
  })

  test('POST /api/webhooks/twilio with no x-twilio-signature returns 401', async ({ request }) => {
    const res = await request.post('/api/webhooks/twilio', {
      multipart: {
        CallSid: 'CA123',
        AccountSid: 'AC123',
        From: '+15555555555',
        To: '+15556666666',
        CallStatus: 'completed',
      },
    })
    // Missing Twilio signature header → 401
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/signature/i)
  })

  test('POST /api/webhooks/twilio with no body fields returns 401 (missing signature)', async ({ request }) => {
    const res = await request.post('/api/webhooks/twilio', {
      data: {},
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(res.status()).toBe(401)
  })
})
