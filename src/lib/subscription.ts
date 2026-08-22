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

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended';

export type EstSubscription = {
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
    return {
      status: 'trial',
      blocked: false,
      label: '—',
      daysLeft: null,
      message: '',
    };
  }

  const status = (est.subscription_status || 'trial') as SubscriptionStatus;
  const now = Date.now();

  if (status === 'suspended') {
    return {
      status: 'suspended',
      blocked: true,
      label: 'Suspendu',
      daysLeft: 0,
      message: `Abonnement impayé (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} ${PLAN.currencyLabel}/mois). Payez pour réactiver.`,
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
          message: `Paiement en retard. Régularisez sous ${PLAN.graceDays} jours (${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois).`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Accès suspendu pour impayé. ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois.`,
      };
    }
    const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
    return {
      status: 'active',
      blocked: false,
      label: 'Actif',
      daysLeft,
      message: daysLeft != null ? `Abonnement actif — ${daysLeft} j restants` : 'Abonnement actif',
    };
  }

  // trial or past_due
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
          message: `Essai d'1 mois terminé. Payez ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA pour continuer (${PLAN.graceDays} j de délai).`,
        };
      }
      return {
        status: 'suspended',
        blocked: true,
        label: 'Suspendu',
        daysLeft: 0,
        message: `Essai terminé. Abonnement : ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois. Contactez le support après paiement.`,
      };
    }
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : PLAN.trialDays;
    return {
      status: 'trial',
      blocked: false,
      label: 'Essai gratuit',
      daysLeft,
      message: `Essai gratuit — ${daysLeft} jour(s) restant(s). Puis ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois.`,
    };
  }

  if (status === 'past_due') {
    return {
      status: 'past_due',
      blocked: false,
      label: 'Paiement requis',
      daysLeft: PLAN.graceDays,
      message: `Régularisez : ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois (Wave / Orange Money / MTN).`,
    };
  }

  return {
    status: 'trial',
    blocked: false,
    label: 'Essai',
    daysLeft: null,
    message: '',
  };
}

export function paymentInstructions(): string {
  return (
    `Offre Stock Manager\n` +
    `• Mise en place stock : ${PLAN.setupStockFcfa.toLocaleString('fr-FR')} F\n` +
    `• Formation / installation : ${PLAN.setupTrainingFcfa.toLocaleString('fr-FR')} F\n` +
    `• Total installation : ${PLAN.setupTotalFcfa.toLocaleString('fr-FR')} F\n` +
    `• 1 mois d'essai gratuit\n` +
    `• Puis ${PLAN.monthlyFcfa.toLocaleString('fr-FR')} F CFA / mois\n` +
    `Paiement : Wave / Orange Money / MTN MoMo\n` +
    `Référence : nom du maquis + mois`
  );
}
