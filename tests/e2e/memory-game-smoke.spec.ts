import { expect, test } from '@playwright/test'

test('completes the five-chapter memory game without horizontal overflow', async ({ page }) => {
  await page.goto('/#/game')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '把今天放进来' }).click()
  await page.getByRole('button', { name: '先不写，也可以' }).click()
  await page.locator('.clue-card').first().click()
  await page.getByRole('button', { name: '把它带回生活' }).click()
  await page.getByRole('button', { name: '我做了这件事' }).click()
  await page.getByRole('button', { name: '继续往前' }).click()
  await expect(page.getByRole('heading', { name: '你在。' })).toBeVisible()
  await page.waitForTimeout(700)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
})
