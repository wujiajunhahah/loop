import { expect, test } from '@playwright/test'

test.describe('W·HERE judge Demo', () => {
  test('does not let a direct Echo Map URL bypass identity confirmation', async ({ page }) => {
    await page.goto('/#/recipient/echo-map')

    await expect(page.getByRole('heading', { name: '请先确认这是留给你的。' })).toBeVisible()
    await expect(page.getByText('刷新或直接打开旅程不会恢复接收者授权，也不会创建新的旅程会话。')).toBeVisible()
    await expect(page.getByRole('heading', { name: '同一把伞下的雨' })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('heading', { name: '请先确认这是留给你的。' })).toBeVisible()
  })

  test('completes the recipient journey with provenance and a postcard', async ({ page }) => {
    await page.goto('/#/')
    await page.getByRole('link', { name: '收到回应' }).first().click()
    await page.getByRole('button', { name: /主动进入/ }).click()
    await page.getByRole('button', { name: '进入 Echo Map 旅程' }).click()

    await expect(page.getByRole('heading', { name: '同一把伞下的雨' })).toBeVisible()
    await page.getByRole('radio', { name: '微光' }).check()
    await page.getByRole('button', { name: '查看这段旅程' }).click()
    await page.getByRole('button', { name: '采用中立动作' }).click()
    await page.getByRole('button', { name: '我已经做了' }).click()

    await expect(page.getByRole('heading', { name: '那次雨中回家。' })).toBeVisible()
    await page.getByRole('button', { name: '打开原始内容' }).click()
    await expect(page.getByText(/你从小就总忘带伞/)).toBeVisible()
    await expect(page.getByText('AI 生成 · 明确标记')).toBeVisible()
    await expect(page.getByText('context-rainy-day').first()).toBeVisible()
    await expect(page.getByText('asset-rainy-day').first()).toBeVisible()

    await page.getByRole('button', { name: '继续' }).click()
    await page.getByLabel('Lin 今天的回应').fill('今天我也听见了雨。')
    await page.getByRole('button', { name: '保存并生成明信片' }).click()

    await expect(page.getByRole('heading', { name: '雨，被带到了今天。' })).toBeVisible()
    await expect(page.getByText('今天我也听见了雨。')).toBeVisible()
    await expect(page.getByText('context-rainy-day').first()).toBeVisible()
    await page.getByRole('button', { name: '收藏明信片并点亮节点' }).click()
    await expect(page.getByText('记忆节点已点亮 · 旅程完成')).toBeVisible()
  })

  test('keeps the core recipient path source-backed and recipient-scoped', async ({ page }) => {
    await page.goto('/#/recipient')
    await page.getByRole('button', { name: /主动进入/ }).click()
    await page.getByRole('button', { name: '继续到今天的回应' }).click()
    await page.getByRole('button', { name: '使用雨天 Demo 内容' }).click()
    await expect(page.getByLabel('今天发生了什么？')).toHaveValue('今天下雨，我又忘记带伞了。')
    await page.getByRole('button', { name: /让过去的记忆回应现在/ }).click()

    await expect(page.getByRole('heading', { name: '一份给今天的回应。' })).toBeVisible()
    await expect(page.getByText('真实原始来源')).toBeVisible()
    await expect(page.getByText('AI 生成 · 明确标记')).toBeVisible()
    await expect(page.getByText('今天下雨，我又忘记带伞了。', { exact: true })).toBeVisible()
    await expect(page.getByText('pull_only · user_opened').first()).toBeVisible()

    await page.getByRole('button', { name: /收藏这封远方回信/ }).click()
    await expect(page.getByRole('heading', { name: '今天与过去，都被好好放在这里。' })).toBeVisible()
    await expect(page.getByText(/Artifact ID · artifact:interaction:/)).toBeVisible()
    await page.getByLabel('为今天再留一句话').fill('我也记得那场雨。')
    await page.getByRole('button', { name: '保存我的话' }).click()
    await expect(page.getByText('已独立保存为接收者内容，不会成为记录者生前事实。')).toBeVisible()
  })
})
