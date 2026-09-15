/**
 * Intégration Tiun (remplacement / complément CinetPay)
 * Docs: https://docs.tiun.io
 *
 * Variables d'environnement requises (Vercel + .env) :
 * - VITE_TIUN_SNIPPET_ID
 * - VITE_TIUN_PRODUCT_ESSENTIEL (productId)
 * - VITE_TIUN_PRODUCT_PRO
 * - VITE_TIUN_PRODUCT_BUSINESS
 *
 * Si SNIPPET_ID est absent → Tiun désactivé, l'app continue avec CinetPay/WhatsApp.
 */
import { tiun } from '@tiun/sdk';
import { supabase } from '@/lib/supabase';

export const TIUN_PRODUCTS = {
  starter: (import.meta.env.VITE_TIUN_PRODUCT_ESSENTIEL as string | undefined)?.trim() || '',
  pro: (import.meta.env.VITE_TIUN_PRODUCT_PRO as string | undefined)?.trim() || '',
  business: (import.meta.env.VITE_TIUN_PRODUCT_BUSINESS as string | undefined)?.trim() || '',
} as const;

const SNIPPET_ID = (import.meta.env.VITE_TIUN_SNIPPET_ID as string | undefined)?.trim() || '';

export function isTiunConfigured(): boolean {
  return Boolean(SNIPPET_ID && (TIUN_PRODUCTS.starter || TIUN_PRODUCTS.pro || TIUN_PRODUCTS.business));
}

let initialized = false;

export function initTiun(): void {
  if (initialized || !SNIPPET_ID || typeof window === 'undefined') return;
  try {
    tiun.init({
      snippetId: SNIPPET_ID,
      language: 'fr',
    });
    initialized = true;

    tiun.on('userChange', async (data: any) => {
      if (data?.event === 'checkout' && data?.user) {
        await syncTiunSubscriptionToSupabase(data.user);
      }
    });
  } catch (e) {
    console.warn('[tiun] init failed', e);
  }
}

export function destroyTiun(): void {
  if (!initialized) return;
  try {
    tiun.destroy?.();
  } catch {
    /* */
  }
  initialized = false;
}

export type TiunPlan = 'starter' | 'pro' | 'business';

export function checkoutTiunPlan(plan: TiunPlan): { ok: boolean; error?: string } {
  if (!isTiunConfigured()) {
    return { ok: false, error: 'Tiun non configuré (VITE_TIUN_SNIPPET_ID manquant)' };
  }
  const productId = TIUN_PRODUCTS[plan];
  if (!productId) {
    return { ok: false, error: `Product ID manquant pour le plan ${plan}` };
  }
  try {
    tiun.checkout({ productId });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Checkout Tiun échoué' };
  }
}

/** Après un paiement Tiun réussi, active l'abonnement côté Supabase (établissement courant) */
async function syncTiunSubscriptionToSupabase(user: {
  userId?: string;
  email?: string;
  productAccess?: string[];
}): Promise<void> {
  try {
    const access = user.productAccess || [];
    let planTier: TiunPlan = 'starter';
    let months = 1;

    if (TIUN_PRODUCTS.business && access.includes(TIUN_PRODUCTS.business)) {
      planTier = 'business';
      months = 12;
    } else if (TIUN_PRODUCTS.pro && access.includes(TIUN_PRODUCTS.pro)) {
      planTier = 'pro';
      months = 1;
    } else if (TIUN_PRODUCTS.starter && access.includes(TIUN_PRODUCTS.starter)) {
      planTier = 'starter';
      months = 1;
    } else {
      return;
    }

    // Récupérer l'établissement actif depuis le profil auth local si possible
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (!sbUser) return;

    const { data: member } = await supabase
      .from('members')
      .select('establishment_id')
      .eq('user_id', sbUser.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const estId = member?.establishment_id;
    if (!estId) return;

    const end = new Date();
    end.setMonth(end.getMonth() + months);

    await supabase
      .from('establishments')
      .update({
        subscription_status: 'active',
        subscription_ends_at: end.toISOString(),
        plan_tier: planTier,
        last_payment_at: new Date().toISOString(),
      })
      .eq('id', estId);

    // Trace
    try {
      await supabase.from('payment_transactions').insert({
        transaction_id: `tiun-${user.userId || 'anon'}-${Date.now()}`,
        establishment_id: estId,
        user_id: sbUser.id,
        amount: 0,
        currency: 'XOF',
        months,
        status: 'completed',
        provider: 'tiun',
        raw: { productAccess: access, email: user.email },
      });
    } catch {
      /* optional */
    }
  } catch (e) {
    console.warn('[tiun] sync subscription failed', e);
  }
}

export function getTiunUser() {
  try {
    return tiun.getUser?.() ?? { isAuthenticated: false, user: null };
  } catch {
    return { isAuthenticated: false, user: null };
  }
}

/** Vérifie côté serveur via /api/tiun/verify (utilise TIUN_API_KEY) */
export async function verifyTiunOnServer(establishmentId?: string): Promise<{
  ok: boolean;
  isAuthenticated?: boolean;
  userInfo?: { userId?: string; email?: string; productAccess?: string[] } | null;
  error?: string;
}> {
  try {
    // @ts-expect-error method may exist on SDK
    const token = await tiun.getUserVerificationToken?.();
    if (!token) return { ok: false, error: 'Pas de token Tiun (utilisateur non connecté Tiun)' };

    const r = await fetch('/api/tiun/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userVerificationToken: token,
        establishmentId: establishmentId || undefined,
      }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data?.error || `HTTP ${r.status}` };
    return {
      ok: true,
      isAuthenticated: data.isAuthenticated,
      userInfo: data.userInfo,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'verify failed' };
  }
}
