import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getSubscriptionState, PLAN, paymentInstructions } from '@/lib/subscription';

const ALLOWED_WHEN_BLOCKED = ['/settings', '/notifications', '/chat', '/subscription'];

export default function SubscriptionGate() {
  const { activeEstablishment, effectiveRole, member } = useAuth();
  const location = useLocation();
  const role = String(effectiveRole || member?.role || '');
  const isPlatformAdmin = ['super_admin', 'admin'].includes(role);

  const state = getSubscriptionState(activeEstablishment as Parameters<typeof getSubscriptionState>[0]);

  if (isPlatformAdmin) return null;
  if (!activeEstablishment) return null;

  const pathOk = ALLOWED_WHEN_BLOCKED.some((p) => location.pathname.startsWith(p));

  return (
    <>
      {!state.blocked && state.message && (
        <div
          className={`mx-3 mt-2 sm:mx-4 rounded-xl px-3 py-2 text-xs sm:text-sm border ${
            state.status === 'past_due'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
              : 'border-stone-700 bg-stone-900/80 text-stone-300'
          }`}
        >
          <span className="font-medium">{state.label}</span>
          {' · '}
          {state.message}
          {(state.status === 'past_due' || (state.daysLeft != null && state.daysLeft <= 5)) && (
            <span className="ml-2 text-amber-300">
              {PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois
            </span>
          )}
        </div>
      )}

      {state.blocked && !pathOk && (
        <div className="fixed inset-0 z-[80] bg-stone-950/95 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-red-500/40 bg-stone-900 p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle size={22} />
              <h2 className="text-lg font-semibold">Accès suspendu</h2>
            </div>
            <p className="text-stone-300 text-sm">{state.message}</p>
            <pre className="text-xs text-stone-400 whitespace-pre-wrap bg-stone-950/50 rounded-xl p-3 border border-stone-800">
              {paymentInstructions()}
            </pre>
            <p className="text-xs text-stone-500">
              Après paiement Mobile Money, l&apos;administrateur réactive votre établissement.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-stone-950 text-sm font-medium"
              >
                <CreditCard size={16} /> Voir consignes
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
