import { Building2, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { BUSINESS_LABELS, normalizeBusinessType } from '@/lib/businessTypes';

/** Bascule établissements — propriétaire / admin */
export default function OwnerSitesBar() {
  const { member, myEstablishments, activeEstablishment, switchEstablishment, effectiveRole } = useAuth();
  const role = String(effectiveRole || member?.role || '');
  const canSwitch = ['super_admin', 'admin', 'owner'].includes(role);
  const currentId = activeEstablishment?.id || member?.establishment_id || '';

  if (!canSwitch || myEstablishments.length === 0) return null;

  return (
    <div className="mb-5 rounded-2xl border border-amber-500/30 bg-stone-900/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-amber-200/80 mb-2 flex items-center gap-1">
        <Building2 size={13} /> Mes établissements
      </p>
      <div className="flex flex-wrap gap-2">
        {myEstablishments.map((e) => {
          const active = e.id === currentId;
          const label = BUSINESS_LABELS[normalizeBusinessType(e.type)] || e.type;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                if (!active) void switchEstablishment(e.id);
              }}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-left text-sm border transition ${
                active
                  ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                  : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-amber-500/40'
              }`}
            >
              <span className="font-semibold flex items-center gap-1">
                {active && <Check size={14} />}
                {e.name}
              </span>
              <span className="block text-[11px] opacity-80">{label}</span>
            </button>
          );
        })}
      </div>
      {myEstablishments.length === 1 && (
        <p className="text-[11px] text-stone-500 mt-2">
          Un seul site pour l’instant. Créez un 2ᵉ établissement depuis le choix d’activité à l’inscription / Super-admin.
        </p>
      )}
    </div>
  );
}
