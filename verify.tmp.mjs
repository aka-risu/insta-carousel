import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newContext({ viewport: { width: 1700, height: 1000 } }).then(c => c.newPage())
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
const log = (...a) => console.log(...a)

await page.goto('http://localhost:5199')
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForSelector('.preview-card')
await page.waitForTimeout(500)

// name the seed and save it
await page.locator('.title-input').fill('dive reflex')
await page.waitForTimeout(350)
await page.locator('.ghost-btn', { hasText: /^save/ }).click()
await page.waitForTimeout(200)
log('after save, designs button text:', await page.locator('.ghost-btn', { hasText: 'designs' }).innerText())

// open library
await page.locator('.ghost-btn', { hasText: 'designs' }).click()
await page.waitForTimeout(200)
log('library rows:', await page.locator('.design-row').count(), '| names:', JSON.stringify(await page.locator('.design-name').all().then(els=>Promise.all(els.map(e=>e.inputValue())))))
log('current row marked:', await page.locator('.design-row.current').count())

// start a NEW design from within library
await page.locator('.designs-card .ghost-btn', { hasText: '+ new' }).click()
await page.waitForTimeout(300)
log('after new: slides', await page.locator('.preview-card').count(), '| title', JSON.stringify(await page.locator('.title-input').inputValue()))

// make it distinct and save as a second design
await page.locator('.title-input').fill('second carousel')
await page.waitForTimeout(300)
await page.locator('.ghost-btn', { hasText: /^save/ }).click()
await page.waitForTimeout(200)

// reload — designs must persist
await page.reload()
await page.waitForSelector('.preview-card')
await page.locator('.ghost-btn', { hasText: 'designs' }).click()
await page.waitForTimeout(200)
const names = await page.locator('.design-name').all().then(els=>Promise.all(els.map(e=>e.inputValue())))
log('after reload, saved designs:', JSON.stringify(names))

// open the first saved design (dive reflex) and confirm it loads its slides
const diveRow = page.locator('.design-row', { hasText: 'dive reflex' })
await diveRow.locator('button', { hasText: 'open' }).click()
await page.waitForTimeout(400)
log('opened dive reflex → title', JSON.stringify(await page.locator('.title-input').inputValue()), '| slides', await page.locator('.preview-card').count())

// duplicate + delete
await page.locator('.ghost-btn', { hasText: 'designs' }).click()
await page.waitForTimeout(150)
await page.locator('.design-row', { hasText: 'dive reflex' }).first().locator('button', { hasText: 'duplicate' }).click()
await page.waitForTimeout(200)
log('rows after duplicate:', await page.locator('.design-row').count())

await browser.close()
log('DONE')
