import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/cinetpay/init
 * Body: { amount, transactionId, description, customerName?, customerEmail?, customerPhone?, returnUrl }
 * Secrets: CINETPAY_API_KEY, CINETPAY_SITE_ID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CINETPAY_API_KEY || process.env.VITE_CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID || process.env.VITE_CINETPAY_SITE_ID;
  if (!apiKey || !siteId) {
    return res.status(503).json({
      error: 'CinetPay non configuré',
      hint: 'Ajoutez CINETPAY_API_KEY et CINETPAY_SITE_ID dans Vercel → Settings → Environment Variables',
    });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const amount = Math.round(Number(body.amount) || 0);
  const transactionId = String(body.transactionId || `SM-${Date.now()}`).slice(0, 40);
  const description = String(body.description || 'Abonnement Stock Manager AI').slice(0, 100);
  const returnUrl = String(body.returnUrl || 'https://stock-manager-ktp.vercel.app/subscription');
  const notifyUrl =
    String(body.notifyUrl || '') ||
    `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://stock-manager-ktp.vercel.app'}/api/cinetpay/notify`;
  const customerName = String(body.customerName || 'Client').slice(0, 50);
  const customerEmail = String(body.customerEmail || 'client@stock-manager.local');
  const customerPhone = String(body.customerPhone || '22500000000').replace(/\D/g, '');

  if (amount < 100) return res.status(400).json({ error: 'Montant minimum 100 XOF' });

  try {
    const payload = {
      apikey: apiKey,
      site_id: siteId,
      transaction_id: transactionId,
      amount,
      currency: 'XOF',
      description,
      return_url: returnUrl,
      notify_url: notifyUrl,
      channels: 'ALL',
      lang: 'fr',
      metadata: body.metadata || '',
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone_number: customerPhone,
      customer_address: body.customerAddress || 'Abidjan',
      customer_city: body.customerCity || 'Abidjan',
      customer_country: 'CI',
      customer_state: 'CI',
      customer_zip_code: '00225',
    };

    const r = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await r.json()) as {
      code?: string;
      message?: string;
      description?: string;
      data?: { payment_url?: string; payment_token?: string };
    };

    if (data.code === '201' && data.data?.payment_url) {
      return res.status(200).json({
        ok: true,
        paymentUrl: data.data.payment_url,
        paymentToken: data.data.payment_token,
        transactionId,
      });
    }

    return res.status(400).json({
      ok: false,
      error: data.description || data.message || 'Échec init CinetPay',
      code: data.code,
      raw: data,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur réseau CinetPay' });
  }
}
