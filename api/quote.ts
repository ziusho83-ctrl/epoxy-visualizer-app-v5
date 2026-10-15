import type { VercelRequest, VercelResponse } from '@vercel/node'
// Isolated preview: never forward customer data or create real leads.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(403).json({ ok: false, error: 'Quote sending is disabled in this preview.' })
}
