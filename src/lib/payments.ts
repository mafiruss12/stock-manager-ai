/**
 * Paiements abonnement — Mobile Money CI
 * - WhatsApp gratuit (immédiat, sans clé)
 * - CinetPay / PayDunya (clés côté Vercel, jamais en clair dans le repo)
 */

import { PLAN, priceForMonths, paymentWhatsAppLink, SUB_PERIODS } from '@/lib/subscription';

export type PaymentProvider = 'whatsapp' | 'cinetpay' | 'paydunya';

export const PAYMENT_METHODS = [
  { id: 'wave' as const, label: 'Wave', icon: '🌊' },
  { id: 'orange_money' as const, label: 'Orange Money', icon: '🟠' },
  { id: 'mtn_money' as const, label: 'MTN Money', icon: '🟡' },
  { id: 'moov_money' as const, label: 'Moov Money', icon: '🔵' },
  { id: 'whatsapp' as const, label: 'WhatsApp (validation manuelle)', icon: '💬' },
];

/** Clés publiques uniquement (si exposées) — secrets restent serveur */
export function getCinetPayPublic(): { siteId?: string; apiKey?: string; enabled: boolean } {
  const siteId = (import.meta.env.VITE_CINETPAY_SITE_ID as string | undefined)?.trim();
  const apiKey = (import.meta.env.VITE_CINETPAY_API_KEY as string | undefined)?.trim();
  return { siteId, apiKey, enabled: Boolean(siteId && apiKey) };
}

export function getPayDunyaPublic(): { publicKey?: string; enabled: boolean } {
  const publicKey = (import.meta.env.VITE_PAYDUNYA_PUBLIC_KEY as string | undefined)?.trim();
  return { publicKey, enabled: Boolean(publicKey) };
}

export function buildSubscriptionWhatsAppMessage(opts: {
  establishmentName: string;
  months: number;
  method?: string;
}): string {
  const amount = priceForMonths(opts.months);
  return [
    '*Stock Manager AI — Paiement abonnement*',
    `Établissement : ${opts.establishmentName}`,
    `Durée : ${opts.months} mois`,
    `Montant : ${amount.toLocaleString('fr-FR')} ${PLAN.currencyLabel}`,
    opts.method ? `Moyen souhaité : ${opts.method}` : null,
    '',
    'Je confirme le paiement Mobile Money / Wave.',
    'Merci d’activer mon abonnement après réception.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function openSubscriptionWhatsApp(opts: {
  establishmentName: string;
  months: number;
  method?: string;
}): void {
  const msg = buildSubscriptionWhatsAppMessage(opts);
  const url = paymentWhatsAppLink(msg);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Init paiement CinetPay (checkout).
 * Sans clés → retourne null (utiliser WhatsApp).
 * Doc : https://docs.cinetpay.com
 */
export async function initCinetPayCheckout(opts: {
  amount: number;
  transactionId: string;
  description: string;
  customerName?: string;
  customerPhone?: string;
  returnUrl: string;
  notifyUrl?: string;
}): Promise<{ paymentUrl?: string; error?: string }> {
  const cfg = getCinetPayPublic();
  if (!cfg.enabled) {
    return { error: 'CinetPay non configuré — utilisez WhatsApp ou ajoutez VITE_CINETPAY_SITE_ID / VITE_CINETPAY_API_KEY' };
  }
  // Le checkout réel doit passer par une Edge Function (secret API).
  // Ici : redirection manuelle vers le tableau de bord marchand / WhatsApp en secours.
  return {
    error:
      'Branchez une fonction serveur /api/cinetpay pour démarrer le paiement sécurisé. En attendant, payez via WhatsApp.',
  };
}

export function listPeriods() {
  return SUB_PERIODS.map((p) => ({
    ...p,
    amount: priceForMonths(p.months),
  }));
}
