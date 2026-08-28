import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/sms/send
 * Body: { to: string | string[], message: string, from?: string }
 * Env: AT_USERNAME, AT_API_KEY, AT_FROM (sender id optionnel)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const username = process.env.AT_USERNAME || process.env.VITE_AT_USERNAME;
  const apiKey = process.env.AT_API_KEY || process.env.VITE_AT_API_KEY;
  const sender = process.env.AT_FROM || process.env.VITE_AT_FROM || 'StockMgr';

  if (!username || !apiKey) {
    return res.status(503).json({
      error: 'Africa’s Talking non configuré',
      hint: 'Ajoutez AT_USERNAME et AT_API_KEY dans Vercel Environment Variables',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let to = body.to;
  const message = String(body.message || '').trim();
  if (!to || !message) return res.status(400).json({ error: 'to et message requis' });

  if (Array.isArray(to)) to = to.join(',');
  // Normalise CI : 07... → +22507...
  to = String(to)
    .split(',')
    .map((n) => {
      let d = n.replace(/\D/g, '');
      if (d.startsWith('00')) d = d.slice(2);
      if (d.startsWith('0') && d.length === 10) d = '225' + d;
      if (!d.startsWith('225') && d.length === 10) d = '225' + d;
      return '+' + d;
    })
    .join(',');

  try {
    const params = new URLSearchParams();
    params.set('username', username);
    params.set('to', to);
    params.set('message', message.slice(0, 480));
    if (sender) params.set('from', sender);

    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        ApiKey: apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const text = await r.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* */
    }
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'SMS error' });
  }
}
