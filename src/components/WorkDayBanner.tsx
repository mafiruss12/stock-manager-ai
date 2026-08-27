import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Unlock, Lock, Loader2, Sun, Moon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { todayISO } from '@/lib/format';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';

type Session = {
  id: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opening_float?: number;
};

export default function WorkDayBanner() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  const canManage = ['super_admin', 'admin', 'owner', 'manager', 'cashier'].includes(
    String(member?.role || '')
  );

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('cash_sessions')
      .select('id, status, opened_at, closed_at, opening_float')
      .eq('establishment_id', estId)
      .eq('session_date', todayISO())
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession((data as Session) || null);
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDay() {
    if (!estId || !canManage || opening) return;
    setOpening(true);
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          establishment_id: estId,
          session_date: todayISO(),
          status: 'open',
          opened_at: new Date().toISOString(),
          opened_by: member?.user_id || null,
          opening_float: 20000,
        })
        .select('id, status, opened_at, closed_at, opening_float')
        .single();
      if (!error && data) setSession(data as Session);
      else await load();
    } finally {
      setOpening(false);
    }
  }

  if (!estId) return null;
  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2 text-sm text-stone-400">
        <Loader2 size={14} className="animate-spin" /> Chargement journée…
      </div>
    );
  }

  const isOpen = session?.status === 'open';
  const isClosed = session?.status === 'closed';

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        isOpen
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : isClosed
            ? 'border-stone-700 bg-stone-900/80'
            : 'border-amber-500/40 bg-amber-500/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
            isOpen ? 'bg-emerald-500/20 text-emerald-400' : isClosed ? 'bg-stone-700 text-stone-300' : 'bg-amber-500/20 text-amber-400'
          }`}
        >
          {isOpen ? <Sun size={18} /> : isClosed ? <Moon size={18} /> : <Unlock size={18} />}
        </span>
        <div>
          <p className="text-sm font-semibold text-stone-100">
            {isOpen
              ? 'Journée ouverte'
              : isClosed
                ? 'Journée clôturée'
                : 'Journée non ouverte'}
          </p>
          <p className="text-xs text-stone-400">
            {isOpen && session?.opened_at
              ? `Ouverte à ${new Date(session.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : isClosed && session?.closed_at
                ? `Clôturée à ${new Date(session.closed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Ouvrez la journée pour démarrer les ventes et le point'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!session && canManage && (
          <button
            type="button"
            onClick={() => void openDay()}
            disabled={opening}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-stone-950 transition hover:opacity-90 disabled:opacity-60"
            style={{ background: theme.primary }}
          >
            {opening ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
            Ouvrir la journée
          </button>
        )}
        {isOpen && (
          <Link
            to="/cloture"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-700"
          >
            <Lock size={14} /> Clôturer
          </Link>
        )}
        {isClosed && (
          <Link
            to="/daily-report"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2 text-sm font-medium text-stone-200 hover:bg-stone-700"
          >
            Voir le rapport
          </Link>
        )}
      </div>
    </div>
  );
}
