/** One deterministic, bounded-resolution compositor for every screen and export. */
export type Point = { x: number; y: number }
export type FloorOptions = {
  points: Point[]
  tones: string[]
  blend: string
  base: string
  chipSize: number
  sheen: 'satin' | 'gloss'
}
export const MAX_EDGE = 1800
const TILE = 1024
let cachedTexture: { key: string; canvas: HTMLCanvasElement } | undefined

export function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
  if (!ctx) throw new Error('Your browser could not create the floor preview.')
  return { canvas, ctx }
}

function random(seed: string) {
  let h = 2166136261
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Overlapping angular vinyl chips, not circles or transparent glitter. */
function texture(blend: string, tones: string[]) {
  const key = `${blend}:${tones.join(',')}`
  if (cachedTexture?.key === key) return cachedTexture.canvas
  const { canvas, ctx } = canvas2d(TILE, TILE)
  const rand = random(key)
  // An opaque chip bed: no exposed solid-color gaps, even between larger chips.
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x += 4) {
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)]
      ctx.fillRect(x, y, 4, 4)
    }
  }
  for (let i = 0; i < 44000; i++) {
    const x = rand() * TILE, y = rand() * TILE
    const r = i < 34000 ? 2.5 + rand() * 5.5 : 0.65 + rand() * 1.5
    const angle = rand() * Math.PI * 2
    const aspect = 0.5 + rand() * 0.55
    const color = tones[Math.floor(rand() * tones.length)]
    const brightness = 0.92 + rand() * 0.14
    const rgb = [1, 3, 5].map(offset => Math.min(255, Math.round(parseInt(color.slice(offset, offset + 2), 16) * brightness)))
    ctx.fillStyle = `rgb(${rgb.join(',')})`
    const vertices = 4 + Math.floor(rand() * 3)
    const polygon: [number, number][] = []
    for (let j = 0; j < vertices; j++) {
      const theta = j / vertices * Math.PI * 2
      const radius = r * (0.72 + rand() * 0.28)
      const u = Math.cos(theta) * radius, v = Math.sin(theta) * radius * aspect
      polygon.push([u * Math.cos(angle) - v * Math.sin(angle), u * Math.sin(angle) + v * Math.cos(angle)])
    }
    // Wrap edge chips to make the tile seamless.
    const xs = [0], ys = [0]
    if (x < r) xs.push(TILE)
    if (x > TILE - r) xs.push(-TILE)
    if (y < r) ys.push(TILE)
    if (y > TILE - r) ys.push(-TILE)
    for (const ox of xs) for (const oy of ys) {
      ctx.beginPath()
      polygon.forEach(([px, py], j) => {
        if (j === 0) ctx.moveTo(x + ox + px, y + oy + py)
        else ctx.lineTo(x + ox + px, y + oy + py)
      })
      ctx.closePath()
      ctx.fill()
    }
  }
  cachedTexture = { key, canvas }
  return canvas
}

/** Low-frequency monochrome illumination: old grout/color is not painted through. */
function lighting(photo: HTMLCanvasElement) {
  const size = 48
  const { canvas, ctx } = canvas2d(size, size)
  ctx.drawImage(photo, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size)
  const luminance = new Float32Array(size * size)
  for (let i = 0; i < luminance.length; i++) {
    luminance[i] = data.data[i * 4] * 0.2126 + data.data[i * 4 + 1] * 0.7152 + data.data[i * 4 + 2] * 0.0722
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sum = 0, weights = 0
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const weight = (5 - Math.abs(dx)) * (5 - Math.abs(dy))
      const sx = Math.max(0, Math.min(size - 1, x + dx))
      const sy = Math.max(0, Math.min(size - 1, y + dy))
      sum += luminance[sy * size + sx] * weight
      weights += weight
    }
    const i = (y * size + x) * 4
    const value = Math.round(192 + sum / weights * 0.245)
    data.data[i] = data.data[i + 1] = data.data[i + 2] = value
    data.data[i + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

export function renderFloor(photo: HTMLCanvasElement, options: FloorOptions) {
  const { width: w, height: h } = photo
  const { canvas, ctx } = canvas2d(w, h)
  // Photo is always composited first. Outside-mask pixels remain identical.
  ctx.drawImage(photo, 0, 0)
  if (options.points.length < 3) return canvas
  const points = options.points.map(p => ({ x: p.x * w / 100, y: p.y * h / 100 }))
  ctx.save()
  ctx.beginPath()
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
  ctx.closePath()
  ctx.clip()
  ctx.fillStyle = options.base
  ctx.fillRect(0, 0, w, h)
  const top = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))))
  const bottom = Math.min(h, Math.ceil(Math.max(...points.map(p => p.y))))
  const depth = Math.max(1, bottom - top)
  if (options.blend !== 'None') {
    const tile = texture(options.blend, options.tones)
    const pattern = ctx.createPattern(tile, 'repeat')
    if (!pattern) throw new Error('Could not create the flake texture.')
    ctx.fillStyle = pattern
    let worldY = 137
    // Screen-independent projection. Small distant chips; larger foreground chips.
    // Scanline mapping keeps work proportional to pixels, never DOM flake count.
    for (let y = top; y < bottom; y++) {
      const t = (y - top) / depth
      const scale = (w / 1200) * 0.48 * options.chipSize * (0.32 + 0.95 * t)
      pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, w * 0.5, y - worldY * scale]))
      ctx.fillRect(0, y, w, 1)
      worldY += 1 / scale
    }
  }
  ctx.globalCompositeOperation = 'multiply'
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(lighting(photo), 0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  // A restrained clear-coat reflection, not a blanket that washes out the blend.
  const gloss = ctx.createLinearGradient(0, top, 0, bottom)
  const strength = options.sheen === 'gloss' ? 0.16 : 0.045
  gloss.addColorStop(0, `rgba(255,255,255,${strength})`)
  gloss.addColorStop(0.45, `rgba(255,255,255,${strength * 0.25})`)
  gloss.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gloss
  ctx.fillRect(0, top, w, depth)
  ctx.restore()
  return canvas
}

export async function loadPhoto(url: string) {
  const image = new Image()
  image.src = url
  await image.decode()
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be decoded. Try a JPEG or PNG.')
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
  const { canvas, ctx } = canvas2d(Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale)))
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}
