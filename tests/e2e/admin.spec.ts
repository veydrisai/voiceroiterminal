import { test, expect } from '@playwright/test'

test.describe('Admin panel (authenticated admin)', () => {
  test('admin page loads', async ({ page }) => {
    const response = await page.goto('/admin')
    expect(response?.status()).toBe(200)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('shows client management UI — title and create form', async ({ page }) => {
    await page.goto('/admin')
    // Wait for the page content to load (client-side rendered)
    await expect(page.getByText('Client accounts')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Create new client')).toBeVisible()
  })

  test('existing clients section is visible', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('Existing clients')).toBeVisible({ timeout: 10000 })
  })

  test('client email input and password input are present', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('input[type="email"][placeholder="client@company.com"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"][placeholder="password"]')).toBeVisible()
  })

  test('Manage client pipeline section exists', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('Manage client pipeline')).toBeVisible({ timeout: 10000 })
  })
})
