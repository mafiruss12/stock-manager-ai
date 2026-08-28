import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Smartphone, Wallet, CheckCircle2, Loader2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PLAN, getSubscriptionState, priceForMonths } from '@/lib/subscription';
import {
  PAYMENT_METHODS,
  openSubscriptionWhatsApp,
  initCinetPayCheckout,
  listPeriods,
} from '@/lib/payments';
import { sendSms } from '@/lib/sms';
import { sendWhatsAppCloud } from '@/lib/whatsappCloud';

export default function SubscriptionPage() {
  const { member, activeEstablishment } = useAuth();
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState('cinetpay');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const amount = priceForMonths(months);
  const state = getSubscriptionState(activeEstablishment as any);
  const periods = useMemo(() => listPeriods(), []);
  const estName = activeEstablishment?.name || 'Mon établissement';
  const estId = activeEstablishment?.id || '';
  const userId = member?.user_id || '';

  async function payCinetPay() {
    setBusy(true);
    setStatus(null);
    const metadata = `${estId}|${months}|${userId}`;
    const r = await initCinetPayCheckout({
      amount,
      description: `Abonnement Stock Manager ${months} mois — ${estName}`,
      customerName: member?.full_name || estName,
      customerEmail: member?.email || undefined,
      customerPhone: (member as { phone?: string } | null)?.phone || undefined,
      metadata,
    });
    setBusy(false);
    if (r.paymentUrl) {
      setStatus('Redirection vers CinetPay…');
      window.location.href = r.paymentUrl;
      return;
    }
    setStatus(r.error || 'CinetPay indisponible — utilisez WhatsApp');
  }

  function payWhatsApp() {
    openSubscriptionWhatsApp({
      establishmentName: estName,
      months,
      method: PAYMENT_METHODS.find((m) => m.id === method)?.label || method,
    });
  }

  async function testSms() {
    const phone = (member as { phone?: string } | null)?.phone;
    if (!phone) {
      setStatus('Ajoutez un numéro dans votre profil pour tester le SMS');
      return;
    }
    setBusy(true);
    const r = await sendSms({
      to: phone,
      message: `Stock Manager AI: test SMS OK. Abonnement ${months} mois = ${amount} F.`,
    });
    setBusy(false);
    setStatus(r.ok ? 'SMS envoyé via Africa’s Talking' : `SMS: ${r.detail}`);
  }

  async function testWhatsAppCloud() {
    const phone = (member as { phone?: string } | null)?.phone;
    if (!phone) {
      setStatus('Ajoutez un numéro dans votre profil pour tester WhatsApp Cloud');
      return;
    }
    setBusy(true);
    const r = await sendWhatsAppCloud({
      to: phone,
      message: `Stock Manager AI — test WhatsApp Cloud OK.\nAbonnement ${months} mois: ${amount} F CFA.`,
    });
    setBusy(false);
    setStatus(r.ok ? 'WhatsApp Cloud envoyé' : `WhatsApp Cloud: ${r.detail}`);
  }

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
          CinetPay · Africa’s Talking · WhatsApp Cloud · {PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois
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
              onClick={() => setMethod(m.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                method === m.id
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
          disabled={busy}
          className="btn-primary w-full flex items-center justify-center gap-2"
          onClick={() => void payCinetPay()}
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Wallet size={18} />}
          Payer avec CinetPay (Wave / OM / MTN / Moov)
        </button>

        <button
          type="button"
          className="btn-secondary w-full flex items-center justify-center gap-2"
          onClick={payWhatsApp}
        >
          <MessageCircle size={18} /> Ou payer via WhatsApp (manuel)
        </button>

        {status && (
          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {status}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-4 text-xs text-stone-400 space-y-2">
        <p className="font-medium text-stone-300 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-amber-400" /> Canaux configurables
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>CinetPay — POST /api/cinetpay/init + notify</li>
          <li>Africa’s Talking SMS — POST /api/sms/send</li>
          <li>WhatsApp Cloud — POST /api/whatsapp/send</li>
          <li>WhatsApp gratuit wa.me — toujours disponible</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" disabled={busy} onClick={() => void testSms()} className="px-2 py-1 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-500/40">
            Tester SMS
          </button>
          <button type="button" disabled={busy} onClick={() => void testWhatsAppCloud()} className="px-2 py-1 rounded-lg border border-stone-700 text-stone-300 hover:border-amber-500/40">
            Tester WhatsApp Cloud
          </button>
        </div>
      </div>
    </div>
  );
}
