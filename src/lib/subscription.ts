/** Offre commerciale Stock Manager CI */

export const PLAN = {
  setupStockFcfa: 15_000,
  setupTrainingFcfa: 10_000,
  setupTotalFcfa: 25_000,
  monthlyFcfa: 10_000,
  trialDays: 30,
  graceDays: 3,
  currencyLabel: 'F CFA',
} as const;

/** Durées d’abonnement proposées (mois) */
export const SUB_PERIODS = [
  { months: 1, label: '1 mois' },
  { months: 3, label: '3 mois' },
  { months: 6, label: '6 mois' },
  { months: 12, label: '1 an' },
  { months: 24, label: '2 ans' },
  { months: 60, label: '5 ans' },
] as const;

const WA_STORAGE = 'mm_payment_whatsapp';

/** Numéro WhatsApp admin pour les paiements (E.164 sans + ou avec) */
export function getPaymentWhatsApp(): string {
  try {
    const v = localStorage.getItem(WA_STORAGE);
    if (v && v.replace(/\D/g, '').length >= 8) return v;
  } catch {
    /* */
  }
  return '2250700000000'; // à configurer dans Super Admin
}

export function setPaymentWhatsApp(phone: string) {
  localStorage.setItem(WA_STORAGE, phone.trim());
}

export function paymentWhatsAppLink(message?: string): string {
  let d = getPaymentWhatsApp().replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '225' + d.slice(1);
  if (!d.startsWith('225') && d.length === 10) d = '225' + d;
  const text =
    message ||
    `Bonjour, je souhaite payer mon abonnement Stock Manager (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois). Mon établissement : `;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function priceForMonths(months: number): number {
  const m = Math.max(1, Math.floor(months));
  return PLAN.monthlyFcfa * m;
}

export function addMonthsISO(from: Date, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended';

export type EstSubscription = {
  id?: string;
  name?: string;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  last_payment_at?: string | null;
};

export function trialEndsAtFromNow(days = PLAN.trialDays): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function getSubscriptionState(est: EstSubscription | null | undefined): {
  status: SubscriptionStatus;
  blocked: boolean;
  label: string;
  daysLeft: number | null;
  message: string;
} {
  if (!est) {
    return { status: 'trial', blocked: false, label: '—', daysLeft: null, message: '' };
  }

  const status = (est.subscription_status || 'trial') as SubscriptionStatus;
  const now = Date.now();

  if (status === 'suspended') {
    return {
      status: 'suspended',
      blocked: true,
      label: 'Suspendu',
      daysLeft: 0,
      message: `Abonnement impayé (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} ${PLAN.currencyLabel}/mois). Contactez-nous sur WhatsApp pour payer.`,
    };
  }

  if (status === 'active') {
    const end = est.subscription_ends_at ? new Date(est.subscription_ends_at).getTime() : null;
    if (end && end < now) {
      const graceEnd = end + PLAN.graceDays * 86400000;
      if (now <= graceEnd) {
        return {
          status: 'past_due',
          blocked: false,
          label: 'En retard',
          daysLeft: Math.max(0, Math.ceil((graceEnd - now) / 86400000)),
          message: `Paiement en retard. Régularisez sous ${PLAN.graceDays} jours via WhatsApp.`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Accès suspendu. Abonnement ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois — payez via WhatsApp.`,
      };
    }
    const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
    return {
      status: 'active',
      blocked: false,
      label: 'Actif',
      daysLeft,
      message:
        daysLeft != null
          ? `Abonnement actif jusqu’au ${est.subscription_ends_at ? new Date(est.subscription_ends_at).toLocaleDateString('fr-FR') : '—'} (${daysLeft} j)`
          : 'Abonnement actif',
    };
  }

  const trialEnd = est.trial_ends_at ? new Date(est.trial_ends_at).getTime() : null;
  if (status === 'trial' || !est.subscription_status) {
    if (trialEnd && trialEnd < now) {
      const graceEnd = trialEnd + PLAN.graceDays * 86400000;
      if (now <= graceEnd) {
        return {
          status: 'past_due',
          blocked: false,
          label: 'Essai terminé',
          daysLeft: Math.max(0, Math.ceil((graceEnd - now) / 86400000)),
          message: `Essai d'1 mois terminé. Payez via WhatsApp (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Essai terminé. Contactez WhatsApp pour activer l'abonnement (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
      };
    }
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : PLAN.trialDays;
    return {
      status: 'trial',
      blocked: false,
      label: 'Essai gratuit',
      daysLeft,
      message: `Essai gratuit — ${daysLeft} j restant(s). Puis ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois.`,
    };
  }

  if (status === 'past_due') {
    return {
      status: 'past_due',
      blocked: false,
      label: 'Paiement requis',
      daysLeft: PLAN.graceDays,
      message: `Régularisez via WhatsApp : ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois.`,
    };
  }

  return { status: 'trial', blocked: false, label: 'Essai', daysLeft: null, message: '' };
}

export function paymentInstructions(): string {
  return (
    `Offre Stock Manager\n` +
    `• Mise en place stock : ${PLAN.setupStockFcfa.toLocaleString('fr-FR')} F\n` +
    `• Formation / installation : ${PLAN.setupTrainingFcfa.toLocaleString('fr-FR')} F\n` +
    `• Total installation : ${PLAN.setupTotalFcfa.toLocaleString('fr-FR')} F\n` +
    `• 1 mois d'essai gratuit\n` +
    `• Puis ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois\n` +
    `• Possible : 3 mois, 6 mois, 1 an, 2 ans, 5 ans\n` +
    `Paiement : contact WhatsApp (Wave / Orange Money / MTN)`
  );
}
