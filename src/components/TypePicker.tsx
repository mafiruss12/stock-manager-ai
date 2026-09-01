import { useState } from 'react';
import { Beer, Store, CalendarDays, Loader2, Check, ShoppingBag, Wrench, ShoppingCart, HardHat, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  BUSINESS_TYPES,
  BUSINESS_LABELS,
  BUSINESS_DESCRIPTIONS,
  BUSINESS_THEMES,
  type BusinessType,
} from '@/lib/businessTypes';

const ICONS: Record<BusinessType, typeof Beer> = {
  maquis: Beer,
  restaurant: UtensilsCrossed,
  magasin: Store,
  boutique: ShoppingBag,
  superette: ShoppingCart,
  quincaillerie: Wrench,
  location_event: CalendarDays,
  btp: HardHat,
};

interface Props {
  mode: 'create' | 'choose-type';
  onDone: () => void;
  /** Préremplir si on crée un établissement */
  defaultName?: string;
}

export default function TypePicker({ mode, onDone, defaultName = '' }: Props) {
  const { member, user, refresh } = useAuth();
  const [selected, setSelected] = useState<BusinessType | null>(null);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected || !user) {
      setError(!user ? 'Session expirée. Reconnectez-vous.' : 'Choisissez un type.');
      return;
    }
    if (mode === 'create' && !name.trim()) {
      setError('Indiquez le nom de l’établissement');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'create') {
        const { data: est, error: e1 } = await supabase
          .from('establishments')
          .insert({
            name: name.trim(),
            type: selected,
            created_by: user.id,
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          })
          .select()
          .single();
        if (e1 || !est) throw new Error(e1?.message || 'Création impossible');

        // Lier le membre à l'établissement (owner si employé sans établissement)
        const nextRole = member && ['employee', 'cashier'].includes(member.role) ? 'owner' : (member?.role || 'owner');
        const { error: eMember } = await supabase
          .from('members')
          .update({ establishment_id: est.id, role: nextRole })
          .eq('user_id', user.id);
        // Si le trigger bloque le rôle, au moins lier l'établissement
        if (eMember) {
          await supabase
            .from('members')
            .update({ establishment_id: est.id })
            .eq('user_id', user.id);
        } else {
          // Vérifier si le rôle a bien été appliqué
          const { data: check } = await supabase
            .from('members')
            .select('role, establishment_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (check && !check.establishment_id) {
            await supabase
              .from('members')
              .update({ establishment_id: est.id })
              .eq('user_id', user.id);
          }
        }

        await supabase.from('member_establishments').upsert(
          {
            user_id: user.id,
            establishment_id: est.id,
            role: nextRole,
            status: 'active',
          },
          { onConflict: 'user_id,establishment_id' }
        );
        await supabase
          .from('establishments')
          .update({ owner_user_id: user.id })
          .eq('id', est.id);
        try {
          localStorage.setItem(
            'mm_active_est',
            JSON.stringify({ id: est.id, type: selected, name: name.trim() })
          );
          localStorage.setItem('mm_est_ids', JSON.stringify([est.id]));
        } catch { /* */ }
      } else {
        // choose-type sur établissement existant
        if (!member.establishment_id) throw new Error('Aucun établissement');
        const { error: e2 } = await supabase
          .from('establishments')
          .update({ type: selected })
          .eq('id', member.establishment_id);
        if (e2) throw new Error(e2.message);
      }
      await refresh();
      onDone();
      // Évite de rester bloqué sur l'écran si refresh async
      window.location.assign('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold font-display text-stone-100 text-center mb-2">
          {mode === 'create' ? 'Créer votre activité' : 'Quel type d’activité ?'}
        </h1>
        <p className="text-stone-400 text-sm text-center mb-6">
          Le menu, les couleurs et le tableau de bord s’adaptent à votre choix.
        </p>

        {mode === 'create' && (
          <div className="mb-5">
            <label className="label">Nom de l’établissement</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. RCO Maquis, Le Gourmet…"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {BUSINESS_TYPES.map((t) => {
            const Icon = ICONS[t];
            const theme = BUSINESS_THEMES[t];
            const active = selected === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelected(t)}
                className={`text-left rounded-2xl border p-4 transition-all ${
                  active ? 'ring-2 scale-[1.02]' : 'hover:border-stone-600'
                }`}
                style={{
                  borderColor: active ? theme.primary : undefined,
                  background: active ? theme.primarySoft : undefined,
                  // @ts-expect-error css var
                  ['--tw-ring-color']: theme.primary,
                }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="p-2.5 rounded-xl"
                    style={{ background: theme.primarySoft, color: theme.primary }}
                  >
                    <Icon size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-100">{BUSINESS_LABELS[t]}</p>
                    <p className="text-xs text-stone-500">{theme.label}</p>
                  </div>
                  {active && <Check size={18} className="ml-auto" style={{ color: theme.primary }} />}
                </div>
                <p className="text-sm text-stone-400">{BUSINESS_DESCRIPTIONS[t]}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-3 text-sm text-error-300 bg-error-500/10 border border-error-500/30 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!selected || loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={selected ? { backgroundColor: BUSINESS_THEMES[selected].primary } : undefined}
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : null}
          Continuer
        </button>
      </div>
    </div>
  );
}
