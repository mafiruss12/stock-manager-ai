import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Smartphone, Wallet, MapPin, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PLAN, getSubscriptionState, SUB_PERIODS, priceForMonths } from '@/lib/subscription';
import {
  PAYMENT_METHODS,
  openSubscriptionWhatsApp,
  getCinetPayPublic,
  getPayDunyaPublic,
  listPeriods,
} from '@/lib/payments';
import { smsHelpText, isSmsConfigured } from '@/lib/sms';
import { osmMapLink } from '@/lib/maps';

export default function SubscriptionPage() {
  const { activeEstablishment } = useAuth();
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState('Wave');
  const amount = priceForMonths(months);
  const state = getSubscriptionState(activeEstablishment as any);
  const cinet = getCinetPayPublic();
  const paydunya = getPayDunyaPublic();
  const periods = useMemo(() => listPeriods(), []);
  const estName = activeEstablishment?.name || 'Mon établissement';

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-16">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200">
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <Wallet className="text-amber-400" size={26} /> Abonnement
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Mobile Money · WhatsApp gratuit · {PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-50">
        <p className="font-semibold">{state.label}</p>
        <p className="text-amber-100/90 mt-1">{state.message}</p>
      </div>

      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3">
        <p className="text-sm font-medium text-stone-200">Durée</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {periods.map((p) => (
            <button
              key={p.months}
              type="button"
              onClick={() => setMonths(p.months)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                months === p.months
                  ? 'border-amber-500 bg-amber-500/15 text-amber-100'
                  : 'border-stone-700 bg-stone-950/40 text-stone-300 hover:border-stone-600'
              }`}
            >
              <span className="font-semibold block">{p.label}</span>
              <span className="text-xs opacity-80">{p.amount.toLocaleString('fr-FR')} F</span>
            </button>
          ))}
        </div>
        <p className="text-lg font-bold text-amber-300">
          Total : {amount.toLocaleString('fr-FR')} {PLAN.currencyLabel}
        </p>
      </div>

      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3">
        <p className="text-sm font-medium text-stone-200 flex items-center gap-2">
          <Smartphone size={16} className="text-amber-400" /> Moyen de paiement
        </p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.label)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${
                method === m.label
                  ? 'border-amber-500 bg-amber-500/15 text-amber-100'
                  : 'border-stone-700 text-stone-400'
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary w-full flex items-center justify-center gap-2"
          onClick={() =>
            openSubscriptionWhatsApp({
              establishmentName: estName,
              months,
              method,
            })
          }
        >
          <MessageCircle size={18} /> Payer via WhatsApp (gratuit)
        </button>
        <p className="text-xs text-stone-500">
          Envoyez la preuve de paiement Wave / Orange / MTN / Moov. Activation manuelle sous 24 h.
        </p>

        <div className="rounded-xl border border-stone-700 bg-stone-950/50 p-3 text-xs text-stone-400 space-y-1">
          <p className="font-medium text-stone-300">Mobile Money automatisé</p>
          <p>
            CinetPay : {cinet.enabled ? <span className="text-emerald-400">clés détectées</span> : 'à configurer (VITE_CINETPAY_*)'}
          </p>
          <p>
            PayDunya : {paydunya.enabled ? <span className="text-emerald-400">clés détectées</span> : 'à configurer (VITE_PAYDUNYA_PUBLIC_KEY)'}
          </p>
          <p className="text-stone-500">
            Sans clés : le paiement se fait par WhatsApp (recommandé pour démarrer).
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-4 text-xs text-stone-400 space-y-2">
        <p className="font-medium text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-400" /> Stack active
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>WhatsApp gratuit — wa.me/+225…</li>
          <li>Mobile Money — Wave, Orange, MTN, Moov (via WA ou CinetPay/PayDunya)</li>
          <li>Cartes — OpenStreetMap (gratuit, sans clé Google)</li>
          <li>
            SMS Afrique — {isSmsConfigured() ? 'configuré' : 'optionnel'} ({smsHelpText().split('\n')[0]})
          </li>
        </ul>
        <a
          className="inline-flex items-center gap-1 text-amber-400 hover:underline"
          href={osmMapLink(5.36, -4.0083)}
          target="_blank"
          rel="noreferrer"
        >
          <MapPin size={12} /> Exemple carte OSM (Abidjan)
        </a>
      </div>
    </div>
  );
}
