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
let cachedTexture: { key: string; canvas: HTMLCanvasElement } | undefined

export function canvas2d(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
  if (!ctx) throw new Error('Your browser could not create the floor preview.')
  return { canvas, ctx }
}

/** Hash absolute floor coordinates; never wrap or reuse a texture tile. */
function cellHash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * A unique, full-frame angular chip field (jittered Voronoi cells).
 * Each cell's position, palette entry and brightness derive from its absolute
 * floor coordinate. Only nearby rows of sites are cached; there is no
 * modulo sampling, repeated bitmap, or viewport-dependent density reduction.
 */
function texture(w: number, h: number, top: number, bottom: number, options: FloorOptions) {
  const key = JSON.stringify([w, h, top, bottom, options.blend, options.tones, options.chipSize, options.base])
  if (cachedTexture?.key === key) return cachedTexture.canvas
  const { canvas, ctx } = canvas2d(w, h)
  const image = ctx.createImageData(w, h)
  const pixels = image.data
  const palette = options.tones.map(color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)))
  const undercoat = [1, 3, 5].map(i => parseInt(options.base.slice(i, i + 2), 16))
  let seed = 2166136261
  for (const char of options.blend) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  const depth = Math.max(1, bottom - top)
  // Same apparent chip scale as the earlier renderer, independent of viewport.
  const unit = (w / 1200) * 0.48 * options.chipSize * 7
  const minScale = unit * 0.32
  const firstCell = Math.floor(-w * 0.5 / minScale) - 4
  const cellCount = Math.ceil(w / minScale) + 10
  type SiteRow = { x: Float32Array; y: Float32Array; color: Uint8Array }
  const rows = new Map<number, SiteRow>()
  function row(cy: number) {
    const cached = rows.get(cy)
    if (cached) return cached
    const result: SiteRow = {
      x: new Float32Array(cellCount), y: new Float32Array(cellCount), color: new Uint8Array(cellCount * 3),
    }
    for (let i = 0; i < cellCount; i++) {
      const cx = firstCell + i
      const hash = cellHash(cx, cy, seed)
      const tint = cellHash(cx, cy, seed ^ 0x53a9b4f1)
      // Full-cell jitter avoids regular rows/columns of chips. Search a 5x5
      // neighborhood so sites beyond adjacent cells cannot produce seams.
      result.x[i] = cx + (hash & 65535) / 65535
      result.y[i] = cy + (hash >>> 16) / 65535
      // Small, deterministic openings in the dense broadcast reveal the
      // opaque base coat. Keep chip locations/colors independent of the base:
      // changing Grey/Tan/Charcoal must not shuffle or tint all the flakes.
      const exposedBase = cellHash(cx, cy, seed ^ 0x2c9277b5) / 4294967296 < 0.18
      const rgb = exposedBase ? undercoat : palette[tint % palette.length]
      const brightness = 0.92 + (tint >>> 16) / 65535 * 0.14
      for (let c = 0; c < 3; c++) result.color[i * 3 + c] = Math.min(255, Math.round(rgb[c] * brightness))
    }
    rows.set(cy, result)
    return result
  }
  let worldY = 17.371
  for (let y = top; y < bottom; y++) {
    const scale = unit * (0.32 + 0.95 * (y - top) / depth)
    // Four subpixel samples average tiny far-field flakes without lowering
    // material coverage, and avoid shimmering/moire at mobile resolutions.
    for (const oy of [0.25, 0.75]) {
      const v = worldY + oy / scale
      const cy = Math.floor(v)
      const nearby = [row(cy - 2), row(cy - 1), row(cy), row(cy + 1), row(cy + 2)]
      for (let x = 0; x < w; x++) {
        const pixel = (y * w + x) * 4
        for (const ox of [0.25, 0.75]) {
          const u = (x + ox - w * 0.5) / scale
          const cx = Math.floor(u) - firstCell
          let best = Infinity, bestRow = nearby[0], bestIndex = cx
          for (const sites of nearby) for (let i = cx - 2; i <= cx + 2; i++) {
            const dx = u - sites.x[i], dy = v - sites.y[i]
            const distance = dx * dx + dy * dy
            if (distance < best) { best = distance; bestRow = sites; bestIndex = i }
          }
          for (let c = 0; c < 3; c++) pixels[pixel + c] += bestRow.color[bestIndex * 3 + c] / 4
        }
        pixels[pixel + 3] = 255
      }
    }
    worldY += 1 / scale
    // Bound working memory even on long portrait hallway photos.
    const keepFrom = Math.floor(worldY) - 3
    for (const cy of rows.keys()) if (cy < keepFrom) rows.delete(cy)
  }
  ctx.putImageData(image, 0, 0)
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
    ctx.drawImage(texture(w, h, top, bottom, options), 0, 0)
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
