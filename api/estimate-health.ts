import type { VercelRequest, VercelResponse } from '@vercel/node'
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  res.setHeader('Cache-Control', 's-maxage=300')
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return res.status(200).json({ configured: false })
  try {
    if (typeof req.query.emailId === 'string' && /^[a-f0-9-]{36}$/.test(req.query.emailId)) {
      const r = await fetch(`https://api.resend.com/emails/${req.query.emailId}`, {headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)})
      const email = await r.json()
      return res.status(200).json({providerStatus:r.status,deliveryStatus:email.last_event ?? null})
    }
    const response = await fetch('https://api.resend.com/domains', {headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)})
    const result = await response.json()
    const domain = result.data?.find((d: {name: string}) => d.name.toLowerCase() === 'luxshieldcoatings.com')
    return res.status(200).json({configured:true,providerStatus:response.status,domainStatus:domain?.status ?? null})
  } catch { return res.status(503).json({configured:true,verified:false}) }
}
