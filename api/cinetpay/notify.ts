import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/cinetpay/notify — IPN CinetPay
 * Vérifie le statut puis active l’abonnement côté Supabase si SERVICE_ROLE dispo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.CINETPAY_API_KEY || process.env.VITE_CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID || process.env.VITE_CINETPAY_SITE_ID;
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const transactionId = body.cpm_trans_id || body.transaction_id || body.transactionId;
  if (!transactionId) return res.status(400).json({ error: 'transaction_id manquant' });

  try {
    if (apiKey && siteId) {
      const check = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: siteId,
          transaction_id: transactionId,
        }),
      });
      const result = (await check.json()) as {
        code?: string;
        data?: { status?: string; amount?: string; metadata?: string };
      };

      if (result.code === '00' && result.data?.status === 'ACCEPTED') {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const meta = String(result.data.metadata || body.metadata || '');
        // metadata format: establishment_id|months|user_id
        const [estId, monthsStr, userId] = meta.split('|');
        if (supabaseUrl && serviceKey && estId) {
          const months = Math.max(1, parseInt(monthsStr || '1', 10) || 1);
          const end = new Date();
          end.setMonth(end.getMonth() + months);
          await fetch(`${supabaseUrl}/rest/v1/establishments?id=eq.${estId}`, {
            method: 'PATCH',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              subscription_status: 'active',
              subscription_ends_at: end.toISOString(),
              subscription_months: months,
            }),
          }).catch(() => null);

          if (userId) {
            await fetch(`${supabaseUrl}/rest/v1/notifications`, {
              method: 'POST',
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                user_id: userId,
                title: 'Paiement reçu',
                body: `Abonnement activé ${months} mois via CinetPay (${transactionId})`,
                message: `Abonnement activé ${months} mois via CinetPay`,
                type: 'payment',
                read: false,
              }),
            }).catch(() => null);
          }
        }
        return res.status(200).json({ ok: true, status: 'ACCEPTED', transactionId });
      }
      return res.status(200).json({ ok: true, status: result.data?.status || 'PENDING', code: result.code });
    }
    return res.status(200).json({ ok: true, received: true, transactionId });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'notify error' });
  }
}
