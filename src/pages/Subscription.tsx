import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Wallet, CheckCircle2, Loader2, Crown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  PLAN, PLANS, getSubscriptionState, getEffectivePlan, getPlanLimits, priceForMonths, type PlanTier,
} from '@/lib/subscription';
import {
  PAYMENT_METHODS,
  openSubscriptionWhatsApp,
  listPeriods,
} from '@/lib/payments';

export default function SubscriptionPage() {
  const { member, activeEstablishment } = useAuth();
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState('whatsapp');
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const estName = activeEstablishment?.name || 'Mon établissement';
  const current = activeEstablishment ? getEffectivePlan(activeEstablishment as any) : null;
  const limits = activeEstablishment ? getPlanLimits(activeEstablishment as any) : null;
  const state = activeEstablishment
    ? getSubscriptionState(activeEstablishment)
    : { label: '—', message: 'Sélectionnez un établissement pour voir votre abonnement.', status: 'trial' as const };

  const targetTier = selectedTier || (current?.id as PlanTier) || 'starter';
  const targetPlan = PLANS[targetTier];
  const amount = useMemo(() => {
    const monthly = targetPlan.monthlyFcfa;
    return monthly * Math.max(1, months);
  }, [targetPlan, months]);

  const periods = listPeriods?.() ?? [
    { months: 1, label: '1 mois' },
    { months: 3, label: '3 mois' },
    { months: 6, label: '6 mois' },
    { months: 12, label: '1 an' },
  ];

  function payWhatsApp() {
    setBusy(true);
    openSubscriptionWhatsApp({
      establishmentName: estName,
      months,
      method: `${targetPlan.label} — ${PAYMENT_METHODS.find((m) => m.id === method)?.label || method}`,
    });
    setStatus('WhatsApp ouvert. Indiquez le forfait et la durée ; activation après confirmation du paiement.');
    setBusy(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-16">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200">
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Wallet className="text-amber-500" size={26} /> Abonnement
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Votre forfait actuel et les offres disponibles · {PLAN.currencyLabel}
        </p>
      </div>

      {/* Forfait actuel — toujours clair */}
      <div className="rounded-2xl border-2 border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
          <Crown size={14} /> Votre forfait actuel
        </p>
        {activeEstablishment && current ? (
          <>
            <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{current.label}</p>
            <p className="text-sm text-stone-700 dark:text-stone-300">{estName}</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">{state.label} — {state.message}</p>
            {limits && (
              <p className="text-xs text-stone-500 dark:text-stone-500">
                {limits.maxEstablishments} site(s) · {limits.maxEmployees} employés · {limits.maxProducts} produits
                {limits.qrOrdering ? ' · Commande QR' : ''}
                {limits.multiSite ? ' · Multi-sites' : ''}
                {limits.ocrAi ? ' · IA OCR' : ''}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-700 dark:text-stone-300">{state.message}</p>
        )}
      </div>

      {/* Autres / tous les forfaits */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Tous les forfaits</h2>
        <p className="text-xs text-stone-500 dark:text-stone-500">
          Choisissez une offre pour payer ou upgrader. Votre forfait actuel est indiqué.
        </p>
        {(['starter', 'pro', 'business'] as PlanTier[]).map((id) => {
          const p = PLANS[id];
          const isCurrent = current?.id === id;
          const isSelected = targetTier === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedTier(id)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                isCurrent
                  ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/20'
                  : isSelected
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/50'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-bold text-stone-900 dark:text-stone-100">{p.label}</p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                    {p.maxEstablishments} site(s) · {p.maxEmployees} employés · {p.maxProducts} produits
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    {[
                      p.qrOrdering && 'QR',
                      p.kitchen && 'Cuisine',
                      p.multiSite && 'Multi-sites',
                      p.ocrAi && 'IA',
                      p.advancedReports && 'Rapports+',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Essentiel stock & caisse'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {isCurrent && (
                    <span className="block text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                      Actuel
                    </span>
                  )}
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    {p.monthlyFcfa.toLocaleString('fr-FR')} F
                  </p>
                  <p className="text-[10px] text-stone-500">/ mois</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Durée + moyen + payer */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900/40 p-4 space-y-3">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
          Payer : <span className="text-amber-700 dark:text-amber-300">{targetPlan.label}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {periods.map((per: { months: number; label: string }) => (
            <button
              key={per.months}
              type="button"
              onClick={() => setMonths(per.months)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                months === per.months
                  ? 'border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                  : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300'
              }`}
            >
              {per.label}
            </button>
          ))}
        </div>
        <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
          {amount.toLocaleString('fr-FR')} {PLAN.currencyLabel}
          <span className="text-sm font-normal text-stone-500"> · {months} mois</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs border ${
                method === m.id
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100'
                  : 'border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={busy || !activeEstablishment}
          className="btn-primary w-full flex items-center justify-center gap-2 min-h-[48px]"
          onClick={payWhatsApp}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <MessageCircle size={18} />}
          Payer via WhatsApp (validation manuelle)
        </button>
        {!activeEstablishment && (
          <p className="text-xs text-amber-700 dark:text-amber-300">Choisissez un établissement pour finaliser le paiement.</p>
        )}
        {status && (
          <p className="text-xs text-stone-700 dark:text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {status}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-4 text-xs text-stone-600 dark:text-stone-400 space-y-2">
        <p className="font-medium text-stone-800 dark:text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-500" /> Comment ça marche
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Votre forfait actuel est toujours affiché en vert ci-dessus.</li>
          <li>Sélectionnez un autre forfait pour upgrader ou renouveler.</li>
          <li>Paiement Mobile Money / Wave via WhatsApp — activation après confirmation.</li>
          <li>Pas de CinetPay / Tiun : inscription et accès simplifiés.</li>
        </ul>
        {member?.role && (
          <p className="pt-1 text-stone-500">Connecté en tant que : {member.role}</p>
        )}
      </div>
    </div>
  );
}
