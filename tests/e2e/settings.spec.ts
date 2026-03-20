import { test, expect } from '@playwright/test'

test.describe('Settings page (authenticated admin)', () => {
  test('settings page loads', async ({ page }) => {
    const response = await page.goto('/settings')
    expect(response?.status()).toBe(200)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('settings title is visible', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 })
  })

  test('API & Integrations section heading is visible', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('API & Integrations')).toBeVisible({ timeout: 10000 })
  })

  test('has Twilio Account SID input field', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Twilio Account SID')).toBeVisible({ timeout: 10000 })
  })

  test('has Vapi API Key input field', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Vapi API Key')).toBeVisible({ timeout: 10000 })
  })

  test('has webhook secret input field', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Webhook secret (optional)')).toBeVisible({ timeout: 10000 })
  })

  test('Revenue settings section is visible', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Revenue').first()).toBeVisible({ timeout: 10000 })
  })

  test('Save changes button is present', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible({ timeout: 10000 })
  })
})
