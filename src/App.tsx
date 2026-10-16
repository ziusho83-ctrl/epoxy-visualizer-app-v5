import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { flakeBlends, solidColors } from './data/palette'
import { FloorPreview } from './rendering/FloorPreview'
import { useFloorPreview } from './rendering/useFloorPreview'
import { canvas2d } from './rendering/floor'

type Point = { x: number; y: number }

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
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
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
  Nightfall: ['#9ca3af', '#4b5563', '#1f2937'],
  Orbit: ['#23467f', '#335f9e', '#f3f4f6', '#cfd5dd', '#111111'],
  Outback: ['#e8dccf', '#8b6a4d', '#2b2219'],
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


function App() {
  const [selectedSolid, setSelectedSolid] = useState(solidColors[0])
  const [selectedFlake, setSelectedFlake] = useState<string>('Stonewash')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [maskPoints, setMaskPoints] = useState<Point[]>([])
  const [autoMaskStatus, setAutoMaskStatus] = useState('')
  const [autoMaskLoading, setAutoMaskLoading] = useState(false)
  const [compare, setCompare] = useState(100)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [quote, setQuote] = useState<QuoteRequest>({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    squareFeet: '',
    notes: '',
  })
  const [quoteStatus, setQuoteStatus] = useState('')
  const [chipSize, setChipSize] = useState(1)
  const [sheen, setSheen] = useState<'satin' | 'gloss'>('gloss')
  const [finishTab, setFinishTab] = useState<'flakes' | 'base'>('flakes')
  const [photoFocus, setPhotoFocus] = useState(false)
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [zip, setZip] = useState('')
  const [contactMethod, setContactMethod] = useState('phone')
  const [requestReviewed, setRequestReviewed] = useState(false)
  const [estimateEnabled, setEstimateEnabled] = useState(false)
  const [sendingEstimate, setSendingEstimate] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [customerEmailStatus, setCustomerEmailStatus] = useState('')
  const [designEmail, setDesignEmail] = useState('')
  const [designStatus, setDesignStatus] = useState('')
  const designStatusRef = useRef<HTMLParagraphElement>(null)
  useEffect(()=>{if(designStatus) designStatusRef.current?.scrollIntoView({block:'nearest'})},[designStatus])
  const [sendingDesign, setSendingDesign] = useState(false)
  const designSendingRef = useRef(false)
  const pendingDesign = useRef<{key:string;body:string}|null>(null)
  function emailImages() {
    if (!rendered?.canvas || !rendered.photo) throw new Error('Your floor preview is not ready yet.')
    const width = Math.round(rendered.canvas.width * Math.min(1, 1000 / Math.max(rendered.canvas.width, rendered.canvas.height)))
    const height = Math.round(width * rendered.canvas.height / rendered.canvas.width)
    const after = canvas2d(width,height)
    after.ctx.drawImage(rendered.canvas,0,0,width,height)
    const comparison = canvas2d(width*2,height+40)
    comparison.ctx.fillStyle='#ffffff'; comparison.ctx.fillRect(0,0,width*2,height+40)
    comparison.ctx.drawImage(rendered.photo,0,40,width,height)
    comparison.ctx.drawImage(rendered.canvas,width,40,width,height)
    comparison.ctx.fillStyle='#111111'; comparison.ctx.font='20px sans-serif'
    comparison.ctx.fillText('Before',12,27); comparison.ctx.fillText('After',width+12,27)
    return {imageDataUrl:after.canvas.toDataURL('image/jpeg',0.8),comparisonDataUrl:comparison.canvas.toDataURL('image/jpeg',0.8)}
  }
  async function emailDesign() {
    if (designSendingRef.current) return
    designSendingRef.current=true; setSendingDesign(true); setDesignStatus('')
    try {
      const body=JSON.stringify({email:designEmail.trim(),selectedSolid,selectedFlake,chipSize,sheen,...emailImages()})
      if (pendingDesign.current?.body !== body) pendingDesign.current={key:crypto.randomUUID(),body}
      const response=await fetch('/api/email-design',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':pendingDesign.current.key},body,signal:AbortSignal.timeout(20000)})
      const result=await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not confirm your email. Please retry.')
      setDesignStatus('Your design email is queued. Check your inbox and junk folder. No estimate request was created.')
    } catch(error) {setDesignStatus(error instanceof Error ? error.message : 'Please retry.')}
    finally {designSendingRef.current=false;setSendingDesign(false)}
  }
  const pendingEstimate = useRef<{key: string; body: string} | null>(null)
  const sendingRef = useRef(false)
  useEffect(() => {
    fetch('/api/quote').then(r => r.ok ? r.json() : null).then(data => setEstimateEnabled(data?.enabled === true)).catch(() => {})
  }, [])
  async function submitEstimate(retryConfirmation = false) {
    if (!estimateEnabled) { setRequestReviewed(true); return }
    if (sendingRef.current || !rendered?.canvas) return
    sendingRef.current = true
    setSendingEstimate(true)
    setQuoteStatus('')
    try {
      const body = retryConfirmation && pendingEstimate.current ? pendingEstimate.current.body : JSON.stringify({...quote, phone: contactMethod === 'phone' ? quote.phone : '', email: quote.email.trim(), zip, selectedSolid, selectedFlake, chipSize, sheen, ...emailImages()})
      if (pendingEstimate.current?.body !== body) pendingEstimate.current = {key: crypto.randomUUID(), body}
      const response = await fetch('/api/quote', {method: 'POST', headers: {'Content-Type': 'application/json', 'Idempotency-Key': pendingEstimate.current.key}, body, signal: AbortSignal.timeout(40000)})
      const result = await response.json()
      if (!response.ok || !result.ok || !result.leadId) throw new Error(result.error || 'Could not confirm your request. Please retry.')
      setCustomerEmailStatus(result.customerEmailStatus || '')
      setLeadId(result.leadId)
      setRequestReviewed(true)
    } catch (error) {
      setQuoteStatus(error instanceof Error ? error.message : 'Could not confirm your request. Please retry.')
    } finally { sendingRef.current = false; setSendingEstimate(false) }
  }
  const requestVersion = useRef(0)
  const saveRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (showSave) saveRef.current?.scrollIntoView({block: 'center'}) }, [showSave])
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  function go(next: number) {
    setPhotoFocus(false)
    setStep(next)
    setShowSave(false)
    window.scrollTo({ top: 0 })
  }
  useEffect(() => { headingRef.current?.focus() }, [step])
  function loadPhoto(url: string, sample = false) {
    requestVersion.current++
    setImageUrl(url)
    setLeadId(''); setCustomerEmailStatus(''); setDesignStatus('')
    setMaskPoints([])
    setQuoteStatus('')
    setRequestReviewed(false)
    setEditing(false)
    setAutoMaskStatus('')
    go(1)
    if (sample) {
      setAutoMaskLoading(false)
      setMaskPoints([{x:18,y:45},{x:82,y:45},{x:100,y:100},{x:0,y:100}])
    } else void autoDetectFloorMask(url)
  }

  const finishLabel = useMemo(() => {
    return selectedFlake === 'None'
      ? `Solid: ${selectedSolid} (No Flake)`
      : `Solid: ${selectedSolid} + Flake: ${selectedFlake}`
  }, [selectedSolid, selectedFlake])

  const polygonPointsAttr = useMemo(() => maskPoints.map((p) => `${p.x},${p.y}`).join(' '), [maskPoints])

  const flakeTones = flakeToneMap[selectedFlake] ?? ['#d0d4db', '#8f96a4', '#59606f']
  const baseSolidRaw = solidBaseMap[selectedSolid] ?? '#7d8289'
  // V5: deepened base for wet-look clear-coat effect
  const baseSolid = deepenColor(baseSolidRaw)
  const rendered = useFloorPreview(imageUrl, {
    points: maskPoints, tones: flakeTones, blend: selectedFlake,
    base: baseSolid, chipSize, sheen,
  })
  const previewReady = Boolean(rendered?.canvas && maskPoints.length >= 3)

  useEffect(() => () => {
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
  }, [imageUrl])

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


  async function autoDetectFloorMask(url = imageUrl) {
    if (!url) return
    const version = ++requestVersion.current

    const startTime = Date.now()
    let timerInterval: ReturnType<typeof setInterval> | undefined
    try {
      setAutoMaskLoading(true)
      timerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        if (version === requestVersion.current) setAutoMaskStatus(`Finding your floor… ${elapsed}s`)
      }, 1000)
      setAutoMaskStatus('Finding your floor…')

      // Downscale image to keep payload small (max ~800px wide)
      const img = new Image()
      img.src = url
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
      if (version !== requestVersion.current) return
      setMaskPoints(data.points)
      setAutoMaskStatus('Check the highlighted area. You can adjust it before continuing.')
    } catch (err) {
      clearInterval(timerInterval)
      console.error('Auto-mask failed:', err)
      if (version !== requestVersion.current) return
      setEditing(true)
      setAutoMaskStatus('We could not find the floor. Try again, or tap around its edges to select it yourself.')
    } finally {
      if (version === requestVersion.current) setAutoMaskLoading(false)
    }
  }


  async function saveDataUrlWithFallback(dataUrl: string, filename: string) {
    const isFacebookInApp = /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent)

    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], filename, { type: blob.type })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Epoxy Preview' })
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
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

  async function exportPreviewImage(kind: 'comparison' | 'after') {
    try {
      if (!imageUrl) return

      if (!rendered?.canvas || !rendered.photo || !previewReady) return
      const img = rendered.photo
      const afterCanvas = rendered.canvas
      const w = afterCanvas.width, h = afterCanvas.height
      const { canvas, ctx } = canvas2d(w, h)

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
      setQuoteStatus('Could not save this image. Try opening this preview in Safari or Chrome.')
    }
  }

  return (
    <main className={`wrap flow-wrap ${step === 2 ? 'finish-workspace' : ''} ${step === 2 && photoFocus ? 'photo-focus' : ''}`}>
      {!estimateEnabled && <div className="preview-banner">Design preview · Estimate requests are not sent or stored.</div>}
      <header className="brand-header">
        <p className="brand-kicker">LuxShield Coatings</p>
        <img src="/luxshield-logo.png" alt="LuxShield Coatings" className="brand-logo" />
      </header>
      <nav className="steps" aria-label="Design progress">
        {['Photo', 'Floor', 'Finish', 'Estimate'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} disabled={i > step && (i > 1 ? !previewReady : !imageUrl)} onClick={() => go(i)}><span>{i + 1}</span>{label}</button>)}
      </nav>
      <h1 ref={headingRef} tabIndex={-1} className="flow-heading">{['See your space with a new epoxy floor.', 'Did we select your floor correctly?', 'Make it your own.', 'Get an estimate for this floor.'][step]}</h1>
      {step === 0 && <section className="upload-card">
        <p>Upload a photo. Explore finishes. Picture the transformation.</p>
        <div className="row"><button className="primary" onClick={() => cameraRef.current?.click()}>Take photo</button><button onClick={() => uploadRef.current?.click()}>Upload photo</button></div>
        <button className="text-button" onClick={() => loadPhoto('/sample-room.svg', true)}>Try a sample</button>
        <p className="muted">If your in-app browser does not open the camera, open this page in Safari or Chrome, or upload an existing photo.</p>
        <p className="muted">Use a well-lit photo with the floor in view. Original photos work better than screenshots.</p>
        <details><summary>How your photo is used</summary><p>Your photo is sent to our floor-detection service to identify the floor. Finish previews are rendered on your device. When estimate sending is available, submitting shares your contact details and finished visualization with LuxShield for follow-up. Reloading clears your design.</p></details>
      </section>}
      <input ref={uploadRef} className="visually-hidden" aria-label="Upload floor photo" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) loadPhoto(URL.createObjectURL(file)); e.target.value = '' }} />
      <input ref={cameraRef} className="visually-hidden" aria-label="Take floor photo" type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files?.[0]; if (file) loadPhoto(URL.createObjectURL(file)); e.target.value = '' }} />
      {step > 0 && <div className="design-layout">
        <div className="visual-panel" style={{ '--photo-ratio': rendered?.canvas ? rendered.canvas.width / rendered.canvas.height : 1 } as React.CSSProperties}>
          <div className={`stage compare-stage ${step === 1 && editing ? 'editing-stage' : ''}`}
            onPointerDown={e => {
              if (step !== 1 || !editing || autoMaskLoading) return
              const target = e.target as Element
              const index = target.getAttribute('data-index')
              if (index !== null) { setDragIndex(Number(index)); e.currentTarget.setPointerCapture(e.pointerId) }
              else addMaskPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
            }}
            onPointerMove={e => { if (step === 1 && editing && dragIndex !== null) updateMaskPoint(dragIndex, e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()) }}
            onPointerUp={() => setDragIndex(null)} onPointerCancel={() => setDragIndex(null)}>
            <img src={imageUrl} alt="Your space before the floor finish" className="preview" />
            {step !== 1 && <><div className="after-layer" style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }}><FloorPreview source={rendered?.canvas} /></div>{compare > 0 && compare < 100 && <div className="compare-handle" style={{left: `${compare}%`}} />}</>}
            {step === 2 && <button className="photo-focus-toggle" aria-label={photoFocus ? 'Show finish controls' : 'Enlarge photo'} aria-pressed={photoFocus} onClick={() => {setPhotoFocus(!photoFocus); setShowSave(false)}}><span>{photoFocus ? 'Show controls' : 'Tap photo to enlarge'}</span></button>}
            {step === 1 && <svg className="mask-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Selected floor boundary">
              {maskPoints.length >= 3 && <polygon className="mask-fill" points={polygonPointsAttr} />}
              {maskPoints.length >= 2 && <polyline className="mask-line" fill="none" points={polygonPointsAttr} />}
              {editing && maskPoints.map((p,i) => <circle key={i} data-index={i} cx={p.x} cy={p.y} r={1.4} className="mask-dot" />)}
            </svg>}
            {autoMaskLoading && <div className="auto-mask-overlay" role="status"><div className="auto-mask-spinner" /><p>{autoMaskStatus}</p></div>}
          </div>
          {step > 1 && <label className="comparison-control"><span>Before</span><input aria-label="Before and after" type="range" min="0" max="100" value={compare} onChange={e => setCompare(Number(e.target.value))} /><span>After</span></label>}
          {step > 1 && <p className="finish-caption">{selectedFlake === 'None' ? 'Solid finish' : selectedFlake} · {selectedSolid} · {sheen === 'gloss' ? 'Gloss' : 'Satin'}</p>}
          <button className="text-button" onClick={() => go(0)}>Change photo</button>
          {step > 1 && <button className="text-button" onClick={() => {setEditing(false); go(1)}}>Adjust floor</button>}
        </div>
        <section className="control-panel">
          {step === 1 && <>
            <p className="muted" role="status">{!autoMaskLoading && (autoMaskStatus || 'The highlighted area is where the new finish will go.')}</p>
            {editing ? <>
              <p>Drag a point to move an edge. Tap to add a point. To redraw, clear the selection and tap around the floor in order.</p>
              <div className="row"><button disabled={!maskPoints.length} onClick={() => setMaskPoints(p => p.slice(0,-1))}>Undo last point</button><button disabled={!maskPoints.length} onClick={() => setMaskPoints([])}>Clear selection</button></div>
            </> : <button disabled={autoMaskLoading} onClick={() => setEditing(true)}>Adjust selection</button>}
            <button className="text-button" disabled={autoMaskLoading} onClick={() => void autoDetectFloorMask()}>Retry detection</button>
            <div className="action-bar"><button className="primary" disabled={!previewReady || autoMaskLoading} onClick={() => {setEditing(false); go(2)}}>Looks good — choose finish</button></div>
          </>}
          {step === 2 && <>
            <div className="finish-tabs" role="group" aria-label="Finish controls">
              <button aria-pressed={finishTab === 'flakes'} onClick={() => setFinishTab('flakes')}>Flakes</button>
              <button aria-pressed={finishTab === 'base'} onClick={() => setFinishTab('base')}>Base color</button>
            </div>
            <div hidden={finishTab !== 'flakes'}>
            <div className="blend-heading"><strong>{selectedFlake === 'None' ? 'Solid only' : selectedFlake}</strong><span>Swipe to explore →</span></div>
            <div className="flake-strip" aria-label="Flake samples">
              {['None', ...flakeBlends].map(f => <button key={f} aria-label={`Choose ${f === 'None' ? 'solid only' : f}`} aria-pressed={selectedFlake === f} className="flake-tile" onClick={e => { setSelectedFlake(f); e.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'}) }}>
                {f === 'None' ? <span className="solid-tile" style={{background:baseSolidRaw}} /> : <img src={`/flakes/${f.toLowerCase().replaceAll(' ', '-')}.jpg`} alt="" loading="lazy" />}
                <span>{f === 'None' ? 'Solid only' : f}</span>
              </button>)}
            </div>
            </div>
            <div hidden={finishTab !== 'base'}>
            <div className="base-picker" role="group" aria-label="Base color">
              <span className="base-label">Base color</span>
              {solidColors.map(c => <button key={c} aria-label={`Base color ${c}`} aria-pressed={selectedSolid === c} onClick={() => setSelectedSolid(c)}><span className="base-dot" style={{background:solidBaseMap[c]}} aria-hidden="true">{selectedSolid === c ? '✓' : ''}</span>{c}</button>)}
            </div>
            </div>
            <details className="more-options"><summary>Size &amp; sheen <span> · More options</span></summary><div className="two-col">
              <label className="field-inline">Flake size<select aria-label="Apparent flake size" value={chipSize} onChange={e => setChipSize(Number(e.target.value))}><option value={0.65}>Fine</option><option value={1}>Standard</option><option value={1.5}>Bold</option></select></label>
              <label className="field-inline">Clear-coat finish<select aria-label="Clear-coat finish" value={sheen} onChange={e => setSheen(e.target.value as 'satin' | 'gloss')}><option value="gloss">Gloss</option><option value="satin">Satin</option></select></label>
            </div><p className="muted">Base color shows between flakes. Flake size is a visual adjustment, not a measured chip dimension. Sample photos are references; confirm with a physical sample.</p></details>
            {rendered?.error && <p role="alert">{rendered.error}</p>}
            {!rendered && <p role="status">Rendering your finish…</p>}
            <div className="action-bar"><button disabled={!previewReady} onClick={() => setShowSave(!showSave)} aria-expanded={showSave}>Save / Share</button><button className="primary" disabled={!previewReady} onClick={() => {setCompare(100); go(3)}}>Get estimate</button></div>
            {showSave && <div className="save-options" ref={saveRef}><button type="button" onClick={()=>setShowSave(false)}>Close save options</button><p>Download your design. No contact details needed.</p><button onClick={() => void exportPreviewImage('after')}>Finished floor</button><button onClick={() => void exportPreviewImage('comparison')}>Before &amp; after</button><p className="muted">Comparison uses the slider position above.</p>{estimateEnabled && <form onSubmit={e=>{e.preventDefault();void emailDesign()}}><h3>Email me this design</h3><label className="field-inline">Design email<input required type="email" autoComplete="email" value={designEmail} onChange={e=>{setDesignEmail(e.target.value);setDesignStatus('')}} /></label><p className="muted">Receive the finished floor and a labeled before/after image. This does not request an estimate or subscribe you to marketing.</p><button type="submit" disabled={sendingDesign}>{sendingDesign ? 'Emailing…' : 'Email my design'}</button>{designStatus && <p ref={designStatusRef} role="status">{designStatus}</p>}</form>}</div>}
          </>}
          {step === 3 && <>
            <p className="muted">Your selected finish and visualization belong with your request. No need to describe them again.</p>
            {requestReviewed ? <div role="status" className="review-state"><h2>{leadId ? "Your estimate request has been submitted." : "Your request is ready to review."}</h2><p><strong>{leadId ? `Reference: ${leadId}. Your request is queued for email delivery to LuxShield.` : "Preview only: nothing was sent or stored."}</strong></p>{customerEmailStatus === 'queued' && <p>A confirmation with your floor design is queued to your email.</p>}{customerEmailStatus === 'failed' && <div><p>Your estimate was submitted, but we could not confirm the customer email.</p><button disabled={sendingEstimate} onClick={()=>void submitEstimate(true)}>Retry confirmation email</button></div>}<p>{quote.customerName} · {contactMethod === 'phone' ? quote.phone : quote.email} · ZIP {zip}</p><p>{finishLabel}</p>{!leadId && <button onClick={() => setRequestReviewed(false)}>Edit details</button>}</div> : <form onSubmit={e => {e.preventDefault(); void submitEstimate()}}>
              <label className="field-inline">Name<input required autoComplete="name" value={quote.customerName} onChange={e => setQuote(q => ({...q,customerName:e.target.value}))} /></label>
              <label className="field-inline">Contact me by<select value={contactMethod} onChange={e => setContactMethod(e.target.value)}><option value="phone">Phone</option><option value="email">Email</option></select></label>
              {contactMethod === 'phone' ? <label className="field-inline">Phone<input required type="tel" autoComplete="tel" minLength={7} title="Enter a phone number with at least seven characters" value={quote.phone} onChange={e => setQuote(q => ({...q,phone:e.target.value}))} /></label> : <label className="field-inline">Email<input required type="email" autoComplete="email" value={quote.email} onChange={e => setQuote(q => ({...q,email:e.target.value}))} /></label>}
              {contactMethod === 'phone' && <label className="field-inline">Email for your design (optional)<input type="email" autoComplete="email" value={quote.email} onChange={e=>setQuote(q=>({...q,email:e.target.value}))} /></label>}
              <label className="field-inline">ZIP code<input required inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a five-digit ZIP code" value={zip} onChange={e => setZip(e.target.value)} /></label>
              <label className="field-inline">Approximate area<select value={quote.squareFeet} onChange={e => setQuote(q => ({...q,squareFeet:e.target.value}))}><option value="">Not sure</option><option>Under 250 sq ft</option><option>250–500 sq ft</option><option>500–800 sq ft</option><option>Over 800 sq ft</option></select></label>
              <details><summary>Add project details (optional)</summary><label className="field-inline">Project address<input autoComplete="street-address" value={quote.address} onChange={e => setQuote(q => ({...q,address:e.target.value}))} /></label><label className="field-inline">Notes<textarea rows={3} value={quote.notes} onChange={e => setQuote(q => ({...q,notes:e.target.value}))} /></label></details>
              <p className="muted">{estimateEnabled ? "By submitting, you ask LuxShield to contact you about this project. Your selected finish and visualization are included. If you provide email, we also send you a confirmation and design copy. No marketing subscription." : "Preview only. Use test details. This form does not send or save a request."}</p>
              <button className="primary" type="submit" disabled={sendingEstimate}>{sendingEstimate ? "Sending…" : estimateEnabled ? "Send estimate request" : "Review request"}</button>
            </form>}
            <button className="text-button" onClick={() => go(2)}>Back to finishes</button>
          </>}
          {quoteStatus && <p role="alert">{quoteStatus}</p>}
        </section>
      </div>}
      <footer className="flow-footer">Digital visualization only. Actual colors, flake size and finish vary with lighting and installation. Confirm your choice with a physical sample.</footer>
    </main>
  )
}
export default App
