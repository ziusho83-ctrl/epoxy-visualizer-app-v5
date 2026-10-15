import { test, expect, type Page } from '@playwright/test'
import { PNG } from 'pngjs'

test.beforeEach(async ({ page }) => {
  // Exercise downloads deterministically; the dedicated share test overrides this.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false })
  })
})

const points = [{ x: 5, y: 45 }, { x: 65, y: 45 }, { x: 65, y: 62 }, { x: 95, y: 62 }, { x: 95, y: 97 }, { x: 5, y: 97 }]
function fixture(width = 1200, height = 800) {
  return { name: 'test-room.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g"><stop stop-color="#4e595a"/><stop offset="1" stop-color="#ddddcc"/></linearGradient></defs><path fill="#bd805d" d="M0 0H${width}V${height}H0Z"/><path fill="url(#g)" d="M0 ${height * 0.4}H${width}V${height}H0Z"/></svg>`) }
}
const save = (page: Page) => page.getByRole('button', { name: 'Save / Share', exact: true })
async function setup(page: Page, width = 1200, height = 800) {
  await page.route('**/api/auto-mask', route => route.fulfill({ json: { points } }))
  await page.goto('/')
  await page.locator('input[type=file]:not([capture])').setInputFiles(fixture(width, height))
  await page.getByRole('button', { name: 'Looks good — choose finish', exact: true }).click()
  await expect(save(page)).toBeEnabled()
  await expect(page.locator('.floor-canvas')).toHaveJSProperty('width', Math.round(width * Math.min(1, 1800 / Math.max(width, height))))
}
async function pixels(page: Page) {
  const data = await page.locator('.floor-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL())
  return PNG.sync.read(Buffer.from(data.split(',')[1], 'base64'))
}
async function downloadPixels(page: Page, button: string) {
  await save(page).click()
  const promise = page.waitForEvent('download')
  await page.getByRole('button', { name: button, exact: true }).click()
  const stream = await (await promise).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(chunk)
  await save(page).click()
  return PNG.sync.read(Buffer.concat(chunks))
}

test('same full-density image on mobile, desktop, and export; photo and concave mask preserved', async ({ page }) => {
  await setup(page)
  const before = await pixels(page)
  expect(await page.locator('.compare-stage svg').count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const outside = await page.evaluate(() => {
    const img = document.querySelector('.compare-stage img') as HTMLImageElement
    const after = document.querySelector('.floor-canvas') as HTMLCanvasElement
    const c = document.createElement('canvas'); c.width = after.width; c.height = after.height
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, c.width, c.height)
    const original = ctx.getImageData(0, 0, c.width, c.height).data
    const edited = after.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
    let changedOutside = 0, opaque = true
    const floorColors = new Set<string>()
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4
      if (y < c.height * 0.43 || (x > c.width * 0.68 && y < c.height * 0.59)) {
        if (original[i] !== edited[i] || original[i + 1] !== edited[i + 1] || original[i + 2] !== edited[i + 2]) changedOutside++
      }
      if (edited[i + 3] !== 255) opaque = false
      if (x > c.width * 0.2 && x < c.width * 0.4 && y > c.height * 0.8 && y < c.height * 0.9) floorColors.add(`${edited[i]},${edited[i + 1]},${edited[i + 2]}`)
    }
    return { changedOutside, opaque, floorColors: floorColors.size }
  })
  expect(outside.changedOutside).toBe(0)
  expect(outside.opaque).toBe(true)
  expect(outside.floorColors).toBeGreaterThan(100)
  const exported = await downloadPixels(page, 'Finished floor')
  expect(exported.data.equals(before.data)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  expect((await pixels(page)).data.equals(before.data)).toBe(true)
  await page.getByRole('slider').fill('50')
  const comparison = await downloadPixels(page, 'Before & after')
  const left = (Math.floor(before.height * 0.85) * before.width + Math.floor(before.width * 0.25)) * 4
  expect(comparison.data.subarray(left, left + 4).equals(before.data.subarray(left, left + 4))).toBe(true)
})

test('size, finish, blend, None and mask-clear controls produce current results', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await setup(page)
  const initial = await pixels(page)
  await selectSetting(page, 'Apparent flake size', '1.5')
  await selectSetting(page, 'Clear-coat finish', 'satin')
  await expect(save(page)).toBeEnabled()
  expect((await pixels(page)).data.equals(initial.data)).toBe(false)
  await page.getByRole('button', {name: 'Choose solid only', exact:true}).click()
  await expect(save(page)).toBeEnabled()
  const solid = await pixels(page)
  expect(solid.data.equals(initial.data)).toBe(false)
  await page.getByRole('button', {name: 'Choose Nightfall', exact:true}).click()
  await expect(save(page)).toBeEnabled()
  expect((await pixels(page)).data.equals(solid.data)).toBe(false)
  await page.getByRole('button', { name: '2 Floor', exact: true }).click()
  await page.getByRole('button', { name: 'Adjust selection', exact: true }).click()
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Looks good — choose finish', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test('portrait images stay bounded and export opaque', async ({ page }) => {
  await setup(page, 2400, 4200)
  const imageBox = (await page.locator('.stage').boundingBox())!
  expect(imageBox.width / imageBox.height).toBeCloseTo(2400 / 4200, 2)
  expect(imageBox.y).toBeGreaterThanOrEqual(0)
  expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  await page.getByRole('button', {name:'Enlarge photo',exact:true}).click()
  await expect(page.getByRole('button',{name:'Save / Share',exact:true})).toBeHidden()
  const enlarged = (await page.locator('.stage').boundingBox())!
  expect(enlarged.height).toBeGreaterThan(imageBox.height + 40)
  await page.getByRole('button',{name:'Show finish controls',exact:true}).click()
  await expect(page.getByRole('button',{name:'Save / Share',exact:true})).toBeVisible()
  const output = await pixels(page)
  expect(output.height).toBe(1800)
  expect(output.width).toBe(1029)
  const exported = await downloadPixels(page, 'Finished floor')
  expect(exported.data.equals(output.data)).toBe(true)
})

test('share cancellation does not trigger an unwanted download', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
      document.documentElement.dataset.sharedType = data.files?.[0].type
      throw new DOMException('Cancelled', 'AbortError')
    } })
  })
  await setup(page)
  let downloaded = false; page.on('download', () => { downloaded = true })
  await save(page).click()
  await page.getByRole('button',{name:'Finished floor',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('data-shared-type', 'image/png')
  expect(downloaded).toBe(false)
})

test('long portrait floor has no repeated clusters at the former tile spacing', async ({ page }) => {
  await setup(page, 900, 1800)
  const correlations = await page.locator('.floor-canvas').evaluate((canvas: HTMLCanvasElement) => {
    const w = canvas.width, h = canvas.height
    const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data
    const top = Math.floor(h * 0.45), bottom = Math.ceil(h * 0.97)
    const green = (x: number, y: number) => data[(y * w + x) * 4 + 1]
    const highpass = (x: number, y: number) => green(x, y) - (green(x - 6, y) + green(x + 6, y)) / 2
    return [0.5, 0.7, 0.9].map(t => {
      let aa = 0, bb = 0, ab = 0
      const center = Math.floor(top + t * (bottom - top))
      for (let y = center - 6; y <= center + 6; y++) {
        const lag = 1024 * (w / 1200) * 0.48 * (0.32 + 0.95 * (y - top) / (bottom - top))
        const offset = Math.floor(lag), fraction = lag - offset
        for (let x = Math.ceil(w * 0.08); x < w * 0.92 - offset - 8; x++) {
          const a = highpass(x, y)
          const b = highpass(x + offset, y) * (1 - fraction) + highpass(x + offset + 1, y) * fraction
          aa += a * a; bb += b * b; ab += a * b
        }
      }
      return ab / Math.sqrt(aa * bb)
    })
  })
  console.log('Former-tile correlation (zero is uncorrelated):', correlations)
  expect(Math.max(...correlations)).toBeLessThan(0.2)
})

test('base changes remain visible under flakes without recoloring or moving the whole pattern', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', {name: 'Choose Nightfall', exact:true}).click()
  await expect(save(page)).toBeEnabled()
  const grey = await pixels(page)
  await selectSetting(page, 'Base color', 'Tan')
  await expect(save(page)).toBeEnabled()
  const tan = await pixels(page)
  await selectSetting(page, 'Base color', 'Charcoal')
  await expect(save(page)).toBeEnabled()
  const charcoal = await pixels(page)
  let samples = 0, changed = 0, redShift = 0, blueShift = 0, darkening = 0
  for (let y = Math.ceil(grey.height * 0.7); y < grey.height * 0.93; y++) {
    for (let x = Math.ceil(grey.width * 0.08); x < grey.width * 0.92; x++) {
      const i = (y * grey.width + x) * 4
      samples++
      if (grey.data[i] !== tan.data[i] || grey.data[i + 1] !== tan.data[i + 1] || grey.data[i + 2] !== tan.data[i + 2]) changed++
      redShift += tan.data[i] - grey.data[i]
      blueShift += tan.data[i + 2] - grey.data[i + 2]
      darkening += grey.data[i + 1] - charcoal.data[i + 1]
    }
  }
  // The undercoat changes visibly; most flake pixels remain EXACTLY unchanged.
  expect(changed / samples).toBeGreaterThan(0.1)
  expect(changed / samples).toBeLessThan(0.5)
  expect(redShift / samples).toBeGreaterThan(2)
  expect(blueShift / samples).toBeLessThan(-3)
  expect(darkening / samples).toBeGreaterThan(5)
  expect((await downloadPixels(page, 'Finished floor')).data.equals(charcoal.data)).toBe(true)
  await selectSetting(page, 'Base color', 'Grey')
  await expect(save(page)).toBeEnabled()
  expect((await pixels(page)).data.equals(grey.data)).toBe(true)
  // The solid-only path must also continue to respect the base selector.
  await page.getByRole('button', {name: 'Choose solid only', exact:true}).click()
  await expect(save(page)).toBeEnabled()
  const solidGrey = await pixels(page)
  await selectSetting(page, 'Base color', 'Tan')
  await expect(save(page)).toBeEnabled()
  expect((await pixels(page)).data.equals(solidGrey.data)).toBe(false)
})

async function selectSetting(page: Page, label: string, value: string) {
  if (label === 'Base color') { await page.getByRole('button',{name:'Base color',exact:true}).click(); await page.getByRole('button', {name: `Base color ${value}`, exact:true}).click(); await page.getByRole('button',{name:'Flakes',exact:true}).click(); return }
  await page.locator('.more-options > summary').click()
  await page.getByLabel(label, {exact:true}).selectOption(value)
  await page.locator('.more-options > summary').click()
}
