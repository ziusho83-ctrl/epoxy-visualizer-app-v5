import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isEmail, imageValid, finishValid, sendEmail, customerEmail, allowEmail } from '../server/design-email.mjs'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control','no-store')
  if (req.method !== 'POST') {res.setHeader('Allow','POST'); return res.status(405).json({error:'Method not allowed'})}
  const token=process.env.RESEND_API_KEY?.trim()
  if (!token) return res.status(503).json({error:'Design email is unavailable. You can still save your images.'})
  const b=req.body, key=req.headers['idempotency-key']
  if (!b || typeof b !== 'object' || Array.isArray(b) || !isEmail(b.email) || !finishValid(b) || !imageValid(b.imageDataUrl) || !imageValid(b.comparisonDataUrl) || typeof key !== 'string' || !/^[a-f0-9-]{36}$/.test(key) || b.website) return res.status(400).json({error:'Enter a valid email and regenerate your design.'})
  if (!allowEmail(b.email,key)) return res.status(429).json({error:'Please wait a few minutes before emailing another design.'})
  try {const emailId=await sendEmail(token,`design-${key}`,customerEmail(b));return res.status(200).json({ok:true,emailId})}
  catch {return res.status(502).json({error:'We could not confirm your design email. Please retry, or save the images instead.'})}
}
