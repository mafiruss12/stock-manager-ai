import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/whatsapp/send
 * Body: { to: string, message: string }  — message texte libre
 *    ou { to: string, template: string, language?: string, components?: unknown[] }
 * Env: WA_TOKEN (permanent ou temporaire), WA_PHONE_NUMBER_ID
 * Doc: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.WA_TOKEN || process.env.WHATSAPP_TOKEN || process.env.VITE_WA_TOKEN;
  const phoneNumberId =
    process.env.WA_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.VITE_WA_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return res.status(503).json({
      error: 'WhatsApp Cloud non configuré',
      hint: 'Ajoutez WA_TOKEN et WA_PHONE_NUMBER_ID (Meta for Developers → WhatsApp → API Setup)',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  let to = String(body.to || '').replace(/\D/g, '');
  if (to.startsWith('00')) to = to.slice(2);
  if (to.startsWith('0') && to.length === 10) to = '225' + to;
  if (!to.startsWith('225') && to.length === 10) to = '225' + to;
  if (!to) return res.status(400).json({ error: 'to requis' });

  const version = process.env.WA_API_VERSION || 'v19.0';
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  let payload: Record<string, unknown>;
  if (body.template) {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: body.template,
        language: { code: body.language || 'fr' },
        components: body.components || [],
      },
    };
  } else {
    const message = String(body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'message ou template requis' });
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body: message.slice(0, 4096) },
    };
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data });
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'WhatsApp error' });
  }
}
