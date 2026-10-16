import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isEmail, imageValid, finishValid, sendEmail, customerEmail } from '../server/design-email.mjs'

// Resend accepts and queues email; this is not a separate lead database.
// Its idempotency window is 24 hours. Do not claim inbox delivery on acceptance.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const token = process.env.RESEND_API_KEY?.trim()
  const enabled = Boolean(token)
  if (req.method === 'GET') return res.status(200).json({ enabled })
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (!enabled) return res.status(503).json({ error: 'Estimate requests are not available yet. Please try again later.' })
  const b = req.body
  if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({ error: 'Invalid request' })
  const fields = ['customerName', 'phone', 'email', 'zip', 'address', 'squareFeet', 'notes', 'selectedSolid', 'selectedFlake', 'sheen'] as const
  const data: Record<string, string | number> = {}
  for (const field of fields) {
    if (typeof b[field] !== 'string' || b[field].length > (field === 'notes' ? 3000 : 250)) return res.status(400).json({ error: 'Invalid request details' })
    data[field] = b[field].trim()
  }
  if (!data.customerName || !/^\d{5}(?:-\d{4})?$/.test(String(data.zip)) ||
      !(String(data.phone).replace(/\D/g, '').length >= 7 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email)))) {
    return res.status(400).json({ error: 'Please enter your name, ZIP, and a valid phone or email.' })
  }
  if (data.email && !isEmail(data.email)) return res.status(400).json({error:'Please enter a valid email.'})
  if (!finishValid(b) || b.website) return res.status(400).json({error:'Invalid finish details'})
  if (data.email && b.comparisonDataUrl !== undefined && !imageValid(b.comparisonDataUrl)) return res.status(400).json({error:'Please regenerate your before/after preview.'})
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || !/^[a-f0-9-]{36}$/.test(key)) return res.status(400).json({ error: 'Invalid request identifier' })
  if (typeof b.imageDataUrl !== 'string' || b.imageDataUrl.length > 1500000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.imageDataUrl)) return res.status(400).json({ error: 'Please regenerate your floor preview.' })
  if (typeof b.chipSize !== 'number' || !Number.isFinite(b.chipSize) || b.chipSize <= 0 || b.chipSize > 10) return res.status(400).json({ error: 'Invalid finish size' })
  data.chipSize = b.chipSize
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
      body: JSON.stringify({
        from: 'LuxShield Estimates <estimates@luxshieldcoatings.com>',
        to: ['sales@luxshieldcoatings.com'],
        ...(data.email ? {reply_to: data.email} : {}),
        subject: `[LuxShield] Estimate request ${key}`,
        text: [
          `Estimate reference: ${key}`,
          `Name: ${data.customerName}`, `Phone: ${data.phone || 'Not supplied'}`,
          `Email: ${data.email || 'Not supplied'}`, `ZIP: ${data.zip}`,
          `Address: ${data.address || 'Not supplied'}`, `Area: ${data.squareFeet || 'Not sure'}`,
          `Base: ${data.selectedSolid}`, `Flakes: ${data.selectedFlake}`,
          `Size: ${data.chipSize}`, `Sheen: ${data.sheen}`, `Notes: ${data.notes}`,
          'The selected floor visualization is attached. Please follow up with the customer.',
        ].join('\n'),
        attachments: [{filename: 'floor-preview.jpg', content: b.imageDataUrl.split(',')[1]}],
      }),
    })
    const result = await response.json()
    if (!response.ok || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(result.id)) throw new Error('Email not accepted')
    let customerEmailStatus = 'not_requested'
    let customerEmailId: string | undefined
    if (data.email) {
      try {
        customerEmailId = await sendEmail(token!, `confirmation-${key}`, customerEmail({...b,...data}, key))
        customerEmailStatus = 'queued'
      } catch { customerEmailStatus = 'failed' }
    }
    return res.status(200).json({ ok: true, leadId: key, emailId: result.id, customerEmailStatus, customerEmailId })
  } catch {
    return res.status(502).json({ error: 'We could not confirm your request. Your details are still here; please retry.' })
  }
}
