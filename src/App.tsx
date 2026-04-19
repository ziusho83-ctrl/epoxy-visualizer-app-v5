import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { flakeBlends, solidColors } from './data/palette'

type Point = { x: number; y: number }

type Flake = {
  x: number      // 0-100
  y: number      // 0-100
  w: number      // base width in 0-100 space
  h: number      // base height
  angle: number  // rotation 0-360
  c: number      // color index
  bright: number // brightness variation 0.92-1.08
}

type QuoteRequest = {
  customerName: string
  phone: string
  email: string
  address: string
  squareFeet: string
  notes: string
}

/* ── V5 color helpers ── */
function hexToHsl(hex: string): [number, number, number] {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, l * 100]
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
function deepenColor(hex: string): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, Math.min(100, s * 1.12), l * 0.92)
}

const flakeToneMap: Record<string, string[]> = {
  // tuned from LuxShield reference photos
  Stonewash: ['#f4f5f4', '#d9d0c3', '#96abc1', '#6f849a', '#243857'],
  Nightfall: ['#e0ddd8', '#c8c4be', '#9ca3af', '#6b7280', '#4b5563', '#1f1f1f'],
  Orbit: ['#23467f', '#335f9e', '#f3f4f6', '#cfd5dd', '#111111'],
  Outback: ['#f5f5f5', '#e8d5be', '#c8a07a', '#a07850', '#6b4530', '#1a1410'],
  'Cabin Fever': ['#efe3cf', '#d8d2c7', '#faf8f4', '#1f1f1f'],
  'Tan Blend': ['#f4efe7', '#ddd2c2', '#c7bbab', '#b59652', '#8b4e32', '#3c302b'],
  'Tidal Wave': ['#eef1f0', '#d8ddd9', '#b9c7cd', '#7f97a6'],
  'Stony Creek': ['#f5f6f7', '#dfe3e6', '#c8cdd1', '#aeb5bb'],
  Raven: ['#f5f5f4', '#d1d5db', '#4b5563', '#111111'],
  Wombat: ['#f3f4f6', '#d1d5db', '#9ca3af', '#3f3f46'],
  Gravel: ['#f8fafc', '#ded7ce', '#b8bec4', '#6b7280'],
  Creekbed: ['#f5efe6', '#ddd1be', '#c8beb4', '#b08d43', '#8b5a3c', '#3b2f2a'],
  Shoreline: ['#fbf7ef', '#eadfcb', '#d2b48c', '#2f2a26'],
  Domino: ['#fafafa', '#d1d5db', '#111111'],
  Carbon: ['#6b7280', '#4b5563', '#2f343b', '#111111'],
  Basalt: ['#f5f6f7', '#d1d5db', '#9ca3af', '#6b7280'],
  Garnet: ['#d6cdc4', '#c8b8a6', '#a8a29e', '#7c8b9c'],
  Obsidian: ['#d8d1c7', '#c9b8a6', '#a5adb4', '#f1eee8'],
  Madras: ['#f1e8d8', '#d6c0a2', '#9f8a73', '#5b5149'],
  Shadow: ['#f8fafc', '#c7c7c7', '#a3a3a3'],
  'California Gray': ['#faf7f0', '#ddd2bf', '#d1d5db', '#9a6040', '#111111'],
  Dolerite: ['#d9cdbd', '#b6bec5', '#8b735f', '#7a8794', '#f2efe9'],
}

const solidBaseMap: Record<string, string> = {
  Grey: '#8f98a3',
  Tan: '#a88c6e',
  Charcoal: '#454850',
}

function seededFlakes(seed: string, count = 80000, toneCount = 3): Flake[] {
  // Full-flake coverage: chips overlap to cover 100% of the floor surface.
  // Real epoxy full-flake has no base color visible — just chips on chips.
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rand = () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const flakes: Flake[] = []
  for (let i = 0; i < count; i++) {
    // Uniform small chip size with slight variation (like real flake chips)
    const baseW = 0.04 + rand() * 0.03 // tight range: 0.35-0.60
    const aspect = 0.65 + rand() * 0.70 // slightly irregular
    const baseH = baseW * aspect
    flakes.push({
      x: rand() * 100,
      y: rand() * 100,
      w: baseW,
      h: baseH,
      angle: rand() * 360,
      c: Math.floor(rand() * toneCount),
      bright: 0.82 + rand() * 0.36, // stronger brightness variation so flake colors read clearly
    })
  }
  return flakes
}

function adjustBrightness(hex: string, factor: number): string {
  const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * factor)))
  const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * factor)))
  const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * factor)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function blendAverage(hexes: string[]): string {
  if (!hexes.length) return '#888888'
  const totals = hexes.reduce(
    (acc, hex) => {
      acc.r += parseInt(hex.slice(1, 3), 16)
      acc.g += parseInt(hex.slice(3, 5), 16)
      acc.b += parseInt(hex.slice(5, 7), 16)
      return acc
    },
    { r: 0, g: 0, b: 0 },
  )
  const n = hexes.length
  return `#${Math.round(totals.r / n).toString(16).padStart(2, '0')}${Math.round(totals.g / n).toString(16).padStart(2, '0')}${Math.round(totals.b / n).toString(16).padStart(2, '0')}`
}

function perspectiveScale(y: number): number {
  return 0.5 + (y / 100) * 1.0
}

const QUOTE_WEBHOOK_URL = (import.meta.env.VITE_QUOTE_WEBHOOK_URL as string | undefined) || '/api/quote'
const BRAND_TONE_1 = '#F6CCAA'
const BRAND_TONE_2 = '#3FCBA2'
const LOGO_PATH = '/logo-icon.png'

const flakeThumbMap: Record<string, string> = {
  Stonewash: '/flakes/stonewash.jpg',
  Nightfall: '/flakes/nightfall.jpg',
  Orbit: '/flakes/orbit.jpg',
  Outback: '/flakes/outback.jpg',
  'Cabin Fever': '/flakes/cabin-fever.jpg',
  'Tan Blend': '/flakes/tan-blend.jpg',
  'Tidal Wave': '/flakes/tidal-wave.jpg',
  'Stony Creek': '/flakes/stony-creek.jpg',
  Raven: '/flakes/raven.jpg',
  Wombat: '/flakes/wombat.jpg',
  Gravel: '/flakes/gravel.jpg',
  Creekbed: '/flakes/creekbed.jpg',
  Shoreline: '/flakes/shoreline.jpg',
  Domino: '/flakes/domino.jpg',
  Carbon: '/flakes/carbon.jpg',
  Basalt: '/flakes/basalt.jpg',
  Garnet: '/flakes/garnet.jpg',
  Obsidian: '/flakes/obsidian.jpg',
  Madras: '/flakes/madras.jpg',
  Shadow: '/flakes/shadow.jpg',
  'California Gray': '/flakes/california-gray.jpg',
  Dolerite: '/flakes/dolerite.jpg',
}

function App() {
  const [selectedSolid, setSelectedSolid] = useState(solidColors[0])
  const [selectedFlake, setSelectedFlake] = useState<string>('Stonewash')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [maskPoints, setMaskPoints] = useState<Point[]>([])
  const [maskMode, setMaskMode] = useState<'manual' | 'auto'>('manual')
  const [autoMaskStatus, setAutoMaskStatus] = useState('')
  const [autoMaskLoading, setAutoMaskLoading] = useState(false)
  const [autoDetectSuccess, setAutoDetectSuccess] = useState(false)
  const [compare, setCompare] = useState(100)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [projectName] = useState('')
  const [companyName] = useState('LuxShield Coatings')
  const [companyContact] = useState('717-490-2643 • Sales@LuxShiledCoatings.com • LuxShieldCoatings.com')
  const [quote, setQuote] = useState<QuoteRequest>({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    squareFeet: '',
    notes: '',
  })
  const [submittingQuote, setSubmittingQuote] = useState(false)
  const [quoteStatus, setQuoteStatus] = useState('')
  const [isMobilePreview, setIsMobilePreview] = useState(false)
  const compareRef = useRef<HTMLDivElement | null>(null)

  const isQuoteReady = useMemo(() => {
    const hasName = quote.customerName.trim().length > 0
    const hasContact = quote.phone.trim().length > 0 || quote.email.trim().length > 0
    return Boolean(imageUrl && hasName && hasContact)
  }, [imageUrl, quote.customerName, quote.phone, quote.email])

  const finishLabel = useMemo(() => {
    return selectedFlake === 'None'
      ? `Solid: ${selectedSolid} (No Flake)`
      : `Solid: ${selectedSolid} + Flake: ${selectedFlake}`
  }, [selectedSolid, selectedFlake])

  const polygonPointsAttr = useMemo(() => maskPoints.map((p) => `${p.x},${p.y}`).join(' '), [maskPoints])

  const insetPolygonPointsAttr = useMemo(() => {
    if (maskPoints.length < 3) return ''

    const cx = maskPoints.reduce((sum, p) => sum + p.x, 0) / maskPoints.length
    const cy = maskPoints.reduce((sum, p) => sum + p.y, 0) / maskPoints.length
    const insetAmount = 0.8

    return maskPoints
      .map((p) => {
        const dx = cx - p.x
        const dy = cy - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 0.01) return `${p.x},${p.y}`
        const ratio = insetAmount / dist
        return `${p.x + dx * ratio},${p.y + dy * ratio}`
      })
      .join(' ')
  }, [maskPoints])

  const flakeTones = flakeToneMap[selectedFlake] ?? ['#d0d4db', '#8f96a4', '#59606f']
  const baseSolidRaw = solidBaseMap[selectedSolid] ?? '#7d8289'
  // V5: deepened base for wet-look clear-coat effect
  const baseSolid = deepenColor(baseSolidRaw)
  const flakeBlendWash = useMemo(() => {
    if (selectedFlake === 'None') return baseSolid
    const avg = blendAverage(flakeTones)
    return deepenColor(avg)
  }, [selectedFlake, flakeTones, baseSolid])

  const exportFlakes = useMemo(
    () => [
      ...seededFlakes(`${selectedSolid}-${selectedFlake}-export-macro`, 110000, flakeTones.length).map((f) => ({ ...f, w: f.w * 5.8, h: f.h * 5.8 })),
      ...seededFlakes(`${selectedSolid}-${selectedFlake}-export-micro`, 180000, flakeTones.length).map((f) => ({ ...f, w: f.w * 1.8, h: f.h * 1.8 })),
    ],
    [selectedSolid, selectedFlake, flakeTones.length],
  )

  const liveFlakes = useMemo(
    () => [
      ...seededFlakes(`${selectedSolid}-${selectedFlake}-live-macro`, isMobilePreview ? 32000 : 110000, flakeTones.length).map((f) => ({ ...f, w: f.w * 5.8, h: f.h * 5.8 })),
      ...seededFlakes(`${selectedSolid}-${selectedFlake}-live-micro`, isMobilePreview ? 38000 : 180000, flakeTones.length).map((f) => ({ ...f, w: f.w * 1.8, h: f.h * 1.8 })),
    ],
    [selectedSolid, selectedFlake, flakeTones.length, isMobilePreview],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobilePreview(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // Keep segmentation model warm — ping on load then every 60s while page is open
  useEffect(() => {
    const ping = () => fetch('/api/warmup').catch(() => {})
    const t = setTimeout(ping, 3000)
    const iv = setInterval(ping, 60_000)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [])

  function toNormalizedPoint(clientX: number, clientY: number, rect: DOMRect) {
    const x = ((clientX - rect.left) / rect.width) * 100
    const y = ((clientY - rect.top) / rect.height) * 100
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }
  }

  function addMaskPoint(clientX: number, clientY: number, rect: DOMRect) {
    const p = toNormalizedPoint(clientX, clientY, rect)
    setMaskPoints((pts) => [...pts, p])
  }

  function updateMaskPoint(index: number, clientX: number, clientY: number, rect: DOMRect) {
    const p = toNormalizedPoint(clientX, clientY, rect)
    setMaskPoints((pts) => pts.map((pt, i) => (i === index ? p : pt)))
  }


  async function autoDetectFloorMask() {
    if (!imageUrl) return

    const startTime = Date.now()
    let timerInterval: ReturnType<typeof setInterval> | undefined
    try {
      setAutoMaskLoading(true)
      timerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        setAutoMaskStatus(`Segmenting floor with AI… ${elapsed}s elapsed`)
      }, 1000)
      setAutoMaskStatus('Segmenting floor with AI… 0s elapsed')

      // Downscale image to keep payload small (max ~800px wide)
      const img = new Image()
      img.src = imageUrl
      await img.decode()

      const maxW = 800
      const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)

      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(img, 0, 0, w, h)

      const imageDataUrl = c.toDataURL('image/jpeg', 0.75)

      const res = await fetch('/api/auto-mask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || `API error ${res.status}`)
      }

      const data = (await res.json()) as { points: { x: number; y: number }[]; error?: string }

      if (data.error) {
        throw new Error(data.error)
      }

      if (!data.points || data.points.length < 3) {
        throw new Error('Could not detect floor boundary')
      }

      clearInterval(timerInterval)
      const totalTime = Math.round((Date.now() - startTime) / 1000)
      setMaskPoints(data.points)
      setMaskMode('auto')
      setAutoDetectSuccess(true)
      setAutoMaskStatus(`AI floor mask applied successfully (${data.points.length} points) in ${totalTime}s. Manual editing is now locked to avoid accidental changes.`)
    } catch (err) {
      clearInterval(timerInterval)
      console.error('Auto-mask failed:', err)
      setAutoDetectSuccess(false)
      setAutoMaskStatus(`AI detection failed: ${(err as Error).message}. You can place points manually if needed.`)
    } finally {
      setAutoMaskLoading(false)
    }
  }


  function drawAfterOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    flakes: Flake[],
  ) {
    if (maskPoints.length < 3) return

    const pts = maskPoints.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h }))

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
    ctx.clip()

    // V5: deepened solid base (clear-coat saturation boost)
    ctx.globalAlpha = 1
    ctx.fillStyle = baseSolid
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1

    // Semi-transparent blend wash between base coat and flakes for fuller coverage
    if (selectedFlake !== 'None') {
      ctx.globalAlpha = 0.28
      ctx.fillStyle = flakeBlendWash
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }

    // Realistic flake broadcast with perspective scaling
    if (selectedFlake !== 'None') {
      for (const d of flakes) {
        const pScale = perspectiveScale(d.y)
        const fw = Math.max(1.35, d.w * pScale * (w / 100))
        const fh = Math.max(1.1, d.h * pScale * (w / 100))
        const px = (d.x / 100) * w
        const py = (d.y / 100) * h
        const color = adjustBrightness(flakeTones[d.c], d.bright)

        ctx.save()
        ctx.globalAlpha = 1
        ctx.fillStyle = color
        ctx.translate(px, py)
        ctx.rotate((d.angle * Math.PI) / 180)
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh)
        ctx.restore()
      }
    }

    // V5: wet-look darkening layer (clear coat over flakes)
    ctx.globalAlpha = 0.10
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1

    // Subtle texture so the floor reads as coated material (not a flat block)
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const shade = Math.random() > 0.5 ? 255 : 0
      const alpha = 0.02 + Math.random() * 0.03
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`
      ctx.fillRect(x, y, 1, 1)
    }

    // V5: perspective-aware Fresnel gloss (vertical, strong at top)
    const g1 = ctx.createLinearGradient(0, 0, 0, h)
    g1.addColorStop(0, 'rgba(255,255,255,0.65)')
    g1.addColorStop(0.40, 'rgba(255,255,255,0.35)')
    g1.addColorStop(0.70, 'rgba(255,255,255,0.15)')
    g1.addColorStop(1, 'rgba(255,255,255,0.0)')
    ctx.globalAlpha = 0.78
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, w, h)

    // V5: centered specular hotspot in upper floor area
    const g2 = ctx.createRadialGradient(w * 0.50, h * 0.25, 0, w * 0.50, h * 0.25, Math.max(w, h) * 0.50)
    g2.addColorStop(0, 'rgba(255,255,255,0.70)')
    g2.addColorStop(0.40, 'rgba(255,255,255,0.30)')
    g2.addColorStop(1, 'rgba(255,255,255,0.0)')
    ctx.globalAlpha = 0.65
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, w, h)

    // V5: flake specularity highlights on medium+ flakes in upper floor
    if (selectedFlake !== 'None') {
      for (const d of flakes) {
        if (d.y > 50) continue
        if (d.w < 0.30) continue
        const pScale = perspectiveScale(d.y)
        const fw = d.w * pScale * (w / 100)
        const specR = fw * 0.15
        const dx = d.x - 50, dy = d.y - 30
        const dist = Math.sqrt(dx * dx + dy * dy)
        const op = Math.max(0, Math.min(0.85, 1.0 - dist / 45))
        if (op < 0.05) continue
        ctx.globalAlpha = op
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc((d.x / 100) * w - specR * 0.6, (d.y / 100) * h - specR * 0.6, specR, 0, Math.PI * 2)
        ctx.fill()
      }
    }


    ctx.restore()
    ctx.globalAlpha = 1
  }

  async function buildAfterPreviewDataUrl(maxWidth = 1200) {
    const img = new Image()
    img.src = imageUrl
    await img.decode()

    const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')

    ctx.drawImage(img, 0, 0, w, h)
    drawAfterOverlay(ctx, w, h, exportFlakes)

    return canvas.toDataURL('image/jpeg', 0.9)
  }

  async function submitQuoteRequest() {
    if (!imageUrl) {
      alert('Upload a garage photo first.')
      return
    }
    if (!quote.customerName.trim() || (!quote.phone.trim() && !quote.email.trim())) {
      alert('Add customer name and at least phone or email.')
      return
    }

    setSubmittingQuote(true)
    setQuoteStatus('Submitting quote request...')

    try {
      const afterPreview = await buildAfterPreviewDataUrl(1200)
      const payload = {
        submittedAt: new Date().toISOString(),
        projectName: projectName.trim() || 'Epoxy Flooring Proposal',
        finishLabel,
        selectedSolid,
        selectedFlake,
        compare,
        customer: quote,
        company: {
          companyName,
          companyContact,
        },
        assets: {
          afterPreviewDataUrl: afterPreview,
        },
      }

      const res = await fetch(QUOTE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`Request failed (${res.status})`)

      setQuoteStatus('Quote request sent successfully.')
      setQuote((prev) => ({ ...prev, notes: '' }))
    } catch {
      setQuoteStatus('Quote submit failed. Try again or export quote card and send manually.')
    } finally {
      setSubmittingQuote(false)
    }
  }

  async function saveDataUrlWithFallback(dataUrl: string, filename: string) {
    const isFacebookInApp = /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent)

    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], filename, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Epoxy Preview' })
        return
      }
    } catch {
      // continue to download fallback
    }

    try {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    } catch {
      // continue to open-tab fallback
    }

    // Some in-app browsers (especially Facebook/Instagram) block downloads.
    if (isFacebookInApp) {
      const w = window.open(dataUrl, '_blank')
      if (!w) window.location.href = dataUrl
      alert('Facebook in-app browser may block direct download. Long-press the opened image and save it, or open this page in your system browser.')
      return
    }

    const w = window.open(dataUrl, '_blank')
    if (!w) window.location.href = dataUrl
  }

  async function exportQuoteCard() {
    try {
      if (!imageUrl) {
        alert('Upload a photo first.')
        return
      }

      const img = new Image()
      img.src = imageUrl
      await img.decode()

      const w = img.naturalWidth
      const h = img.naturalHeight

      const afterCanvas = document.createElement('canvas')
      afterCanvas.width = w
      afterCanvas.height = h
      const afterCtx = afterCanvas.getContext('2d')
      if (!afterCtx) return
      afterCtx.drawImage(img, 0, 0, w, h)
      drawAfterOverlay(afterCtx, w, h, exportFlakes)

      const outW = 1600
      const headerH = 240
      const bodyH = 900
      const outH = headerH + bodyH + 180

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, outW, outH)

      // Subtle textured black background
      for (let i = 0; i < 2200; i++) {
        const x = Math.random() * outW
        const y = Math.random() * outH
        const a = 0.02 + Math.random() * 0.03
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fillRect(x, y, 1, 1)
      }

      // Modern abstract line accents
      ctx.save()
      ctx.globalAlpha = 0.32
      ctx.strokeStyle = BRAND_TONE_2
      ctx.lineCap = 'round'

      const drawLine = (x1: number, y1: number, x2: number, y2: number, width: number) => {
        ctx.beginPath()
        ctx.lineWidth = width
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      drawLine(outW * 0.72, outH * 0.08, outW * 0.95, outH * 0.08, 3)
      drawLine(outW * 0.76, outH * 0.11, outW * 0.95, outH * 0.11, 2)
      drawLine(outW * 0.80, outH * 0.14, outW * 0.95, outH * 0.14, 1.5)

      drawLine(outW * 0.06, outH * 0.88, outW * 0.28, outH * 0.88, 3)
      drawLine(outW * 0.06, outH * 0.91, outW * 0.24, outH * 0.91, 2)
      drawLine(outW * 0.06, outH * 0.94, outW * 0.20, outH * 0.94, 1.5)

      ctx.restore()

      const brandGrad = ctx.createLinearGradient(0, 0, outW, 0)
      brandGrad.addColorStop(0, BRAND_TONE_1)
      brandGrad.addColorStop(1, BRAND_TONE_2)
      ctx.fillStyle = brandGrad
      ctx.fillRect(0, 0, outW, 12)

      ctx.fillStyle = BRAND_TONE_1
      ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillText(companyName || 'Your Company', 64, 90)

      try {
        const logo = new Image()
        logo.src = LOGO_PATH
        await logo.decode()
        const targetH = 92
        const targetW = (logo.naturalWidth / logo.naturalHeight) * targetH
        const x = outW - 64 - targetW
        const y = 32
        ctx.drawImage(logo, x, y, targetW, targetH)
      } catch {
        // If logo is missing/unreadable, continue export without it.
      }

      ctx.font = '30px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = BRAND_TONE_1
      ctx.fillText(companyContact || 'Phone • Email', 64, 136)

      const label = projectName.trim() || 'Epoxy Flooring Proposal'
      const dateLabel = new Date().toLocaleDateString()
      ctx.font = '28px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = BRAND_TONE_1
      ctx.fillText(`Project: ${label}`, 64, 182)
      ctx.fillText(`Date: ${dateLabel}`, 64, 218)

      const margin = 64
      const gap = 36
      const panelW = Math.floor((outW - margin * 2 - gap) / 2)
      const panelH = bodyH - 110
      const topY = headerH + 40

      ctx.fillStyle = '#111827'
      ctx.fillRect(margin, topY, panelW, panelH)
      ctx.fillRect(margin + panelW + gap, topY, panelW, panelH)

      ctx.drawImage(img, margin, topY, panelW, panelH)
      ctx.drawImage(afterCanvas, margin + panelW + gap, topY, panelW, panelH)

      ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = BRAND_TONE_1
      ctx.fillText('Before', margin, topY - 10)
      ctx.fillText('After', margin + panelW + gap, topY - 10)

      ctx.font = '27px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = BRAND_TONE_1
      ctx.fillText(`Finish: ${finishLabel}`, margin, outH - 98)
      ctx.fillText('System: Decorative flake epoxy with high-gloss topcoat', margin, outH - 62)

      ctx.font = '20px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
      ctx.fillStyle = BRAND_TONE_1
      ctx.fillText('Disclaimer: This is a digital preview for visualization only. Final color/texture may vary due to lighting, surface prep,', margin, outH - 30)
      ctx.fillText('application method, and monitor/device settings.', margin, outH - 8)

      const filename = `epoxy-quote-${Date.now()}.png`
      const dataUrl = canvas.toDataURL('image/png')
      await saveDataUrlWithFallback(dataUrl, filename)
    } catch {
      alert('Quote export failed on this device. Try again or use comparison export.')
    }
  }

  async function exportPreviewImage(kind: 'comparison' | 'after') {
    try {
      if (!imageUrl) return

      const img = new Image()
      img.src = imageUrl
      await img.decode()

      const maxDim = 1600
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))

      const afterCanvas = document.createElement('canvas')
      afterCanvas.width = w
      afterCanvas.height = h
      const afterCtx = afterCanvas.getContext('2d')
      if (!afterCtx) return
      afterCtx.drawImage(img, 0, 0, w, h)
      drawAfterOverlay(afterCtx, w, h, exportFlakes)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (kind === 'after') {
        ctx.drawImage(afterCanvas, 0, 0)
      } else {
        ctx.drawImage(img, 0, 0, w, h)
        const cut = Math.floor((compare / 100) * w)
        if (cut > 0) {
          ctx.drawImage(afterCanvas, 0, 0, cut, h, 0, 0, cut, h)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(Math.max(0, cut - 1), 0, 2, h)
        }
      }

      const filename = `epoxy-${kind}-${Date.now()}.png`
      const dataUrl = canvas.toDataURL('image/png')
      await saveDataUrlWithFallback(dataUrl, filename)
    } catch {
      alert('We could not save or share on this device just yet. Please take a screenshot for now, and we can improve this in the next update.')
    }
  }

  return (
    <main className="wrap">
      <header className="brand-header">
        <div className="brand-copy">
          <p className="brand-kicker">LuxShield Coatings</p>
          <h1>Epoxy Visualizer V5</h1>
          <p>Shielding surfaces with lasting beauty.</p>
          <p className="brand-powered">App powered by AI.</p>
        </div>
        <img src="/luxshield-logo.png" alt="LuxShield Coatings logo" className="brand-logo" />
      </header>

      <section className="card">
        <h2>1) Upload Garage Photo</h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setImageUrl(URL.createObjectURL(file))
            setMaskPoints([])
            setMaskMode('manual')
            setAutoMaskStatus('')
            setAutoDetectSuccess(false)
          }}
        />
        {!imageUrl && <p className="muted">Please upload a photo to begin.</p>}
      </section>

      <section className="card">
        <h2>2) Floor Mask Tool (Polygon)</h2>
        <p className="muted">Please start with Auto-Detect Floor first. If AI detection does not map the floor correctly, you can then use manual point adjustments.</p>
        {imageUrl ? (
          <>
            <div className="row">
              <button onClick={() => void autoDetectFloorMask()} disabled={autoMaskLoading}>
                {autoMaskLoading ? 'Detecting…' : 'Auto-Detect Floor (Beta)'}
              </button>
              <button
                onClick={() => {
                  setMaskPoints((pts) => pts.slice(0, -1))
                  setMaskMode('manual')
                  setAutoDetectSuccess(false)
                }}
                disabled={!maskPoints.length || autoDetectSuccess}
              >
Undo Last Point
              </button>
              <button
                onClick={() => {
                  setMaskPoints([])
                  setMaskMode('manual')
                  setAutoDetectSuccess(false)
                }}
                disabled={!maskPoints.length}
              >
Clear Floor Mask
              </button>
            </div>
            <div
              className="stage"
              onPointerDown={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()

                if (autoDetectSuccess) return
                if (dragIndex !== null) return
                const target = e.target as HTMLElement
                if (target.dataset.point === 'mask-dot') return
                addMaskPoint(e.clientX, e.clientY, rect)
                setMaskMode('manual')
              }}
              onPointerMove={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()

                if (autoDetectSuccess) return
                if (dragIndex === null) return
                updateMaskPoint(dragIndex, e.clientX, e.clientY, rect)
                setMaskMode('manual')
              }}
              onPointerUp={() => {
                setDragIndex(null)
              }}
              onPointerLeave={() => {
                setDragIndex(null)
              }}
            >
              <img src={imageUrl} alt="garage" className="preview" />
              {autoMaskLoading && (
                <div className="auto-mask-overlay">
                  <div className="auto-mask-spinner" />
                  <p>{autoMaskStatus}</p>
                </div>
              )}
              <svg className="mask-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {maskPoints.length >= 3 && <polygon className="mask-fill" points={polygonPointsAttr} />}
                {maskPoints.length >= 2 && <polyline className="mask-line" fill="none" points={polygonPointsAttr} />}
                {maskPoints.map((p, idx) => (
                  <circle
                    key={`${p.x}-${p.y}-${idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={0.8}
                    className="mask-dot"
                    data-point="mask-dot"
                    onPointerDown={(e) => {
                      if (autoDetectSuccess) return
                      e.stopPropagation()
                      setDragIndex(idx)
                    }}
                  />
                ))}
              </svg>
            </div>
            <small>{maskPoints.length} point(s) selected • Selection mode: {maskMode === 'auto' ? 'Auto' : 'Manual'}</small>
            {autoMaskStatus && <small className="muted">{autoMaskStatus}</small>}
          </>
        ) : (
          <p className="muted">Please upload a photo first.</p>
        )}
      </section>

      <section className="card configurator-card">
        <div className="section-title-row">
          <div>
            <h2>3) Finish Selection + Live Preview</h2>
            <div className="section-accent" />
          </div>
          <img src="/luxshield-logo.png" alt="LuxShield mark" className="section-logo" />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="muted">Preview and export quality: Ultra.</span>
        </div>
        {imageUrl ? (
          <>
            <div className="stage compare-stage" ref={compareRef}>
              <img src={imageUrl} alt="garage before" className="preview" />

              <div className="after-layer" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}>
                <img src={imageUrl} alt="garage after" className="preview after-preview" />
                <svg className="mask-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <clipPath id="floorClip">
                      {maskPoints.length >= 3 && <polygon points={insetPolygonPointsAttr} />}
                    </clipPath>
                    <linearGradient id="glossGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="white" stopOpacity={0.48} />
                      <stop offset="40%" stopColor="white" stopOpacity={0.24} />
                      <stop offset="70%" stopColor="white" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="white" stopOpacity={0.0} />
                    </linearGradient>
                    <radialGradient id="glossSpot" cx="50%" cy="25%" r="50%">
                      <stop offset="0%" stopColor="white" stopOpacity={0.48} />
                      <stop offset="40%" stopColor="white" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="white" stopOpacity={0.0} />
                    </radialGradient>
                  </defs>

                  {maskPoints.length >= 3 && <polygon className="overlay-base" points={polygonPointsAttr} fill={baseSolid} />}
                  {maskPoints.length >= 3 && selectedFlake !== 'None' && <polygon className="overlay-blend-wash" points={polygonPointsAttr} fill={flakeBlendWash} />}

                  {maskPoints.length >= 3 && selectedFlake !== 'None' && (
                    <g clipPath="url(#floorClip)">
                      {liveFlakes.map((d, i) => {
                        const pScale = perspectiveScale(d.y)
                        const fw = d.w * pScale
                        const fh = d.h * pScale
                        const color = adjustBrightness(flakeTones[d.c], d.bright)
                        return (
                          <rect
                            key={`flake-${i}`}
                            x={d.x - fw / 2}
                            y={d.y - fh / 2}
                            width={fw}
                            height={fh}
                            rx={fw * 0.1}
                            fill={color}
                            opacity={1}
                            transform={`rotate(${d.angle}, ${d.x}, ${d.y})`}
                          />
                        )
                      })}
                    </g>
                  )}

                  {maskPoints.length >= 3 && (
                    <polygon className="overlay-wet" points={polygonPointsAttr} fill="black" />
                  )}

                  {maskPoints.length >= 3 && <polygon className="overlay-gloss" points={polygonPointsAttr} fill="url(#glossGradient)" />}
                  {maskPoints.length >= 3 && <polygon className="overlay-gloss-spot" points={polygonPointsAttr} fill="url(#glossSpot)" />}

                  {maskPoints.length >= 3 && selectedFlake !== 'None' && (
                    <g clipPath="url(#floorClip)">
                      {liveFlakes.map((d, i) => {
                        if (d.y > 50) return null
                        if (d.w < 0.30) return null
                        const pScale = perspectiveScale(d.y)
                        const fw = d.w * pScale
                        const specR = fw * 0.15
                        const dx = d.x - 50, dy = d.y - 30
                        const dist = Math.sqrt(dx * dx + dy * dy)
                        const op = Math.max(0, Math.min(0.85, 1.0 - dist / 45))
                        if (op < 0.05) return null
                        return (
                          <circle
                            key={`spec-${i}`}
                            cx={d.x - specR * 0.6}
                            cy={d.y - specR * 0.6}
                            r={specR}
                            fill="white"
                            opacity={op}
                          />
                        )
                      })}
                    </g>
                  )}
                </svg>
              </div>

              <div className="compare-handle" style={{ left: `${compare}%` }} />
            </div>

            <div className="row two-col" style={{ marginTop: 14 }}>
              <label className="field-inline">
                <span>Solid Base (Opaque)</span>
                <div className="select-with-swatch">
                  <select value={selectedSolid} onChange={(e) => setSelectedSolid(e.target.value)}>
                    {solidColors.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <span className="color-swatch" style={{ background: baseSolidRaw }} />
                </div>
              </label>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="field-label">Flake Blend</span>
              <div className="flake-grid">
                <button
                  className={`flake-grid-item${selectedFlake === 'None' ? ' active' : ''}`}
                  onClick={() => setSelectedFlake('None')}
                >
                  <div className="flake-grid-thumb" style={{ background: baseSolidRaw, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff' }}>None</div>
                  <span className="flake-grid-label">None</span>
                </button>
                {flakeBlends.map((f) => (
                  <button
                    key={f}
                    className={`flake-grid-item${selectedFlake === f ? ' active' : ''}`}
                    onClick={() => setSelectedFlake(f)}
                  >
                    <img className="flake-grid-thumb" src={flakeThumbMap[f] || ''} alt={f} loading="lazy" />
                    <span className="flake-grid-label">{f}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="badge">Selected finish: {finishLabel} • High-gloss appearance</p>

            <div className="row" style={{ marginTop: 12 }}>
              <label className="slider-label">Before / After Preview: {compare}%</label>
              <input type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(Number(e.target.value))} />
              <input
                type="number"
                min={0}
                max={100}
                value={compare}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setCompare(Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0)
                }}
                style={{ width: 86 }}
              />
              <button onClick={() => exportPreviewImage('comparison')}>Save or Share Comparison</button>
              <button onClick={() => exportPreviewImage('after')}>Save or Share Final Preview</button>
            </div>
          </>
        ) : (
          <p className="muted">Please upload an image to view the preview.</p>
        )}
      </section>

      <section className="card">

        <h2>4) Client Quote Request Form</h2>
        <div className="section-accent" />
        <p className="muted">Please use this form for website leads after creating a visualization, so we can follow up with a formal quote.</p>
        <div className="row two-col" style={{ marginTop: 10 }}>
          <label className="field-inline">
            <span>Customer Name *</span>
            <input value={quote.customerName} onChange={(e) => setQuote((q) => ({ ...q, customerName: e.target.value }))} />
          </label>
          <label className="field-inline">
            <span>Phone</span>
            <input value={quote.phone} onChange={(e) => setQuote((q) => ({ ...q, phone: e.target.value }))} />
          </label>
        </div>
        <div className="row two-col">
          <label className="field-inline">
            <span>Email</span>
            <input value={quote.email} onChange={(e) => setQuote((q) => ({ ...q, email: e.target.value }))} />
          </label>
          <label className="field-inline">
            <span>Estimated Square Feet</span>
            <input value={quote.squareFeet} onChange={(e) => setQuote((q) => ({ ...q, squareFeet: e.target.value }))} />
          </label>
        </div>
        <div className="row">
          <label className="field-inline" style={{ width: '100%' }}>
            <span>Project Address</span>
            <input value={quote.address} onChange={(e) => setQuote((q) => ({ ...q, address: e.target.value }))} />
          </label>
        </div>
        <div className="row">
          <label className="field-inline" style={{ width: '100%' }}>
            <span>Notes</span>
            <textarea rows={4} value={quote.notes} onChange={(e) => setQuote((q) => ({ ...q, notes: e.target.value }))} />
          </label>
        </div>
        <div className="row">
          <button onClick={submitQuoteRequest} disabled={submittingQuote}>{submittingQuote ? 'Submitting...' : 'Submit Quote Request for Review'}</button>
          <span className="muted">We will review your request and follow up shortly.</span>
        </div>
        {quoteStatus && <p className="status-msg">{quoteStatus}</p>}
      </section>

      <section className="card">
        <h2>5) Quote Export</h2>
        <div className="section-accent" />
        <div className="row two-col" style={{ marginTop: 10 }}>
          <label className="field-inline">
            <span>Company Name</span>
            <input value={companyName} readOnly />
          </label>
          <label className="field-inline">
            <span>Contact (phone/email)</span>
            <input value={companyContact} readOnly />
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={exportQuoteCard} disabled={!isQuoteReady}>Export Digital Visualization</button>
          {!isQuoteReady && <span className="muted">Please complete Section 4 (name and phone or email) and upload a photo first.</span>}
        </div>
      </section>

      
    </main>
  )
}

export default App
