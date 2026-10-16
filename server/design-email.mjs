import palette from '../src/data/palette-data.json' with { type: 'json' }
const {flakeBlends, solidColors} = palette

export const salesEmail = 'sales@luxshieldcoatings.com'
export const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
export function imageValid(value) {
  return typeof value === 'string' && value.length <= 1500000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value) && Buffer.from(value.split(',')[1], 'base64').subarray(0, 3).equals(Buffer.from([255,216,255]))
}
export function finishValid(b) {
  return solidColors.includes(String(b.selectedSolid)) && (b.selectedFlake === 'None' || flakeBlends.includes(String(b.selectedFlake))) && ['gloss','satin'].includes(String(b.sheen)) && typeof b.chipSize === 'number' && Number.isFinite(b.chipSize) && b.chipSize > 0 && b.chipSize <= 10
}
export async function sendEmail(token, key, body) {
  const r = await fetch('https://api.resend.com/emails', {method:'POST', signal:AbortSignal.timeout(10000), headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`, 'Idempotency-Key':key}, body:JSON.stringify(body)})
  const result = await r.json()
  if (!r.ok || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(result.id)) throw new Error('Email not accepted')
  return result.id
}
export function customerEmail(b, reference) {
  const finish = `Base: ${b.selectedSolid} | Flakes: ${b.selectedFlake} | Size: ${b.chipSize} | Sheen: ${b.sheen}`
  return {
    from:'LuxShield Coatings <estimates@luxshieldcoatings.com>', to:[String(b.email).trim()], reply_to:salesEmail,
    subject: reference ? 'We received your LuxShield estimate request' : 'Your LuxShield floor design',
    text: [reference ? `Thanks—your estimate request has been submitted to LuxShield. Reference: ${reference}.` : 'Here is your LuxShield floor design. This is a design copy, not an estimate request.',
      b.comparisonDataUrl ? 'Your finished-floor and before/after images are attached.' : 'Your finished-floor image is attached.', finish,
      reference ? 'We will contact you about your project. You can reply to this email with any questions.' : 'Request an estimate: reply to this email, or visit https://epoxy-visualizer-app-v5.vercel.app/ and choose Get estimate after uploading your photo again.',
      'Explore finishes: https://epoxy-visualizer-app-v5.vercel.app/',
      'Digital visualization only. Actual color, flake size and finish vary with lighting and installation. Confirm with a physical sample.',
      'You have not been subscribed to marketing emails.',
    ].join('\n\n'),
    attachments:[{filename:'finished-floor.jpg',content:String(b.imageDataUrl).split(',')[1]}, ...(b.comparisonDataUrl ? [{filename:'before-and-after.jpg',content:String(b.comparisonDataUrl).split(',')[1]}] : [])],
  }
}
// Best-effort per-instance burst guard, not a distributed quota or durable store.
const bursts = new Map()
export function allowEmail(email, key) {
  const now=Date.now(), normalized=email.toLowerCase()
  let entry=bursts.get(normalized)
  if (!entry || entry.until <= now) {entry={until:now+600000,keys:new Set()};bursts.set(normalized,entry)}
  if (entry.keys.has(key)) return true
  if (entry.keys.size >= 5) return false
  entry.keys.add(key)
  if (bursts.size > 1000) bursts.delete(bursts.keys().next().value)
  return true
}
