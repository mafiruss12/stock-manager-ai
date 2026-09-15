import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/tiun/verify
 * Body: { userVerificationToken: string }
 * Header: (called from frontend after tiun.getUserVerificationToken())
 *
 * Vérifie l'utilisateur côté Tiun et peut synchroniser l'abonnement Supabase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.TIUN_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'TIUN_API_KEY manquant sur Vercel' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const token = String(body.userVerificationToken || body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'userVerificationToken requis' });

  const base =
    process.env.TIUN_API_BASE ||
    (process.env.TIUN_SANDBOX === 'true' ? 'https://api-sandbox.tiun.live' : 'https://api.tiun.live');

  try {
    const r = await fetch(`${base}/live_api/s2s/v1/users/verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TIUN-API-KEY': apiKey,
      },
      body: JSON.stringify({ userVerificationToken: token }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: data });
    }

    // Optionnel : sync abonnement si productAccess présent + establishmentId fourni
    const estId = String(body.establishmentId || '').trim();
    const userInfo = data?.userInfo;
    if (r.ok && data?.isAuthenticated && estId && Array.isArray(userInfo?.productAccess) && userInfo.productAccess.length > 0) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
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
            last_payment_at: new Date().toISOString(),
          }),
        }).catch(() => null);

        await fetch(`${supabaseUrl}/rest/v1/payment_transactions`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            transaction_id: `tiun-verify-${userInfo.userId}-${Date.now()}`,
            establishment_id: estId,
            amount: 0,
            currency: 'XOF',
            months: 1,
            status: 'completed',
            provider: 'tiun',
            raw: userInfo,
          }),
        }).catch(() => null);
      }
    }

    return res.status(200).json({
      ok: true,
      isAuthenticated: data?.isAuthenticated === true,
      userInfo: data?.userInfo || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'verify error' });
  }
}
