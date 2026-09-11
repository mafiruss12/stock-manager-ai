/**
 * Hook HTTP sécurité — Webhook Supabase / appels internes
 * POST /api/security/auth-hook
 *
 * Headers:
 *   Authorization: Bearer <SECURITY_HOOK_SECRET>
 *   ou x-security-hook-secret: <SECURITY_HOOK_SECRET>
 *
 * Body JSON exemples:
 *   { "type": "login_success", "user_id": "uuid", "meta": {} }
 *   { "type": "USER_SIGNED_UP", "record": { "id": "...", "email": "..." } }  // Database Webhook
 *
 * Variables Vercel:
 *   SECURITY_HOOK_SECRET (ou CRON_SECRET en secours)
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function getEnv(name: string): string | undefined {
  return process.env[name] || process.env[`VITE_${name}`];
}

function authorized(req: VercelRequest): boolean {
  const secret = getEnv('SECURITY_HOOK_SECRET') || getEnv('CRON_SECRET') || '';
  if (!secret) return false;
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const hdr = String(req.headers['x-security-hook-secret'] || '');
  const q = typeof req.query.secret === 'string' ? req.query.secret : '';
  return auth === secret || hdr === secret || q === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl =
    getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || '';
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase service non configuré' });
  }

  const body = (req.body || {}) as Record<string, unknown>;
  let eventType = String(body.type || body.event_type || 'webhook');
  let userId = (body.user_id as string) || null;
  let meta: Record<string, unknown> = (body.meta as Record<string, unknown>) || {};

  // Format Database Webhook Supabase
  const record = body.record as Record<string, unknown> | undefined;
  if (record) {
    userId = (record.id as string) || (record.user_id as string) || userId;
    if (body.table === 'users' || String(body.schema) === 'auth') {
      eventType = eventType === 'webhook' ? 'signup' : eventType;
      meta = { ...meta, email: record.email, table: body.table };
    }
  }

  // Normaliser types auth hook
  const map: Record<string, string> = {
    USER_SIGNED_UP: 'signup',
    USER_UPDATED: 'user_updated',
    login: 'login_success',
    LOGIN: 'login_success',
  };
  eventType = map[eventType] || eventType;

  try {
    const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/security_events`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        event_type: eventType,
        user_id: userId,
        meta,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
        created_at: new Date().toISOString(),
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'insert_failed', detail: t.slice(0, 300) });
    }
    return res.status(200).json({ ok: true, event_type: eventType });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error';
    return res.status(500).json({ error: msg });
  }
}
