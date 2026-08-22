import { useEffect, useState } from 'react';
import { Calculator, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, todayISO, daysAgoISO } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';

interface PeriodData {
  sales: number;
  expenses: number;
  purchases: number;
  profit: number;
  cashSales: number;
  mobileSales: number;
  categoryBreakdown: { category: string; amount: number }[];
}

export default function Accounting() {
  const { member, effectiveRole } = useAuth();
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(String(effectiveRole || member?.role || ''));
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [data, setData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!member?.establishment_id) { setLoading(false); return; }
      const estId = member.establishment_id;
      let startDate: string;
      switch (period) {
        case 'today': startDate = todayISO(); break;
        case 'week': startDate = daysAgoISO(7); break;
        case 'year': startDate = daysAgoISO(365); break;
        default: startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      }

      const [salesRes, expensesRes, purchasesRes] = await Promise.all([
        supabase.from('sales').select('total, payment_method, created_at').eq('establishment_id', estId).gte('created_at', startDate),
        supabase.from('expenses').select('amount, category').eq('establishment_id', estId).gte('created_at', startDate),
        supabase.from('purchases').select('total').eq('establishment_id', estId).gte('created_at', startDate).eq('status', 'received'),
      ]);

      const sales = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const expenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const purchases = (purchasesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const cashSales = (salesRes.data ?? []).filter((r) => r.payment_method === 'cash').reduce((s, r) => s + Number(r.total), 0);
      const mobileSales = (salesRes.data ?? []).filter((r) => r.payment_method === 'mobile_money').reduce((s, r) => s + Number(r.total), 0);

      const catMap: Record<string, number> = {};
      for (const e of (expensesRes.data ?? [])) {
        catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount);
      }
      const categoryBreakdown = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }));

      setData({ sales, expenses, purchases, profit: sales - expenses - purchases, cashSales, mobileSales, categoryBreakdown });
      setLoading(false);
    })();
  }, [member, period]);

  if (!canSeeFinance) return <div className="p-6 text-stone-400">Comptabilité réservée au propriétaire.</div>;
  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<Calculator size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  if (!data) return null;

  const periodLabels: Record<string, string> = { today: 'Aujourd\'hui', week: '7 jours', month: 'Ce mois', year: 'Cette année' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Comptabilité</h1>
          <p className="text-stone-400 text-sm">Vue financière détaillée</p>
        </div>
        <div className="flex gap-2">
          {(Object.keys(periodLabels) as ('today' | 'week' | 'month' | 'year')[]).map((p) => (
            <button
              key={p}
              onClick={() => { setLoading(true); setPeriod(p); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === p ? 'bg-primary-500/15 text-primary-300' : 'text-stone-400 hover:bg-stone-800'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Ventes" value={formatFCFA(data.sales)} icon={<TrendingUp size={24} />} accent="success" />
        <StatCard label="Dépenses" value={formatFCFA(data.expenses)} icon={<TrendingDown size={24} />} accent="error" />
        <StatCard label="Achats" value={formatFCFA(data.purchases)} icon={<Wallet size={24} />} accent="warning" />
        <StatCard label="Bénéfice net" value={formatFCFA(data.profit)} icon={<ArrowUpRight size={24} />} accent={data.profit >= 0 ? 'primary' : 'error'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4">Modes de paiement</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-2"><DollarSign size={16} className="text-secondary-400" /> Espèces</span>
              <span className="font-bold text-stone-200">{formatFCFA(data.cashSales)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-2"><Wallet size={16} className="text-primary-400" /> Mobile Money</span>
              <span className="font-bold text-stone-200">{formatFCFA(data.mobileSales)}</span>
            </div>
            <div className="border-t border-stone-800 pt-3 flex items-center justify-between">
              <span className="text-stone-400">Total</span>
              <span className="font-bold text-primary-400">{formatFCFA(data.cashSales + data.mobileSales)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4">Dépenses par catégorie</h2>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-stone-500">Aucune dépense sur cette période</p>
          ) : (
            <div className="space-y-2">
              {data.categoryBreakdown.map((c) => {
                const pct = data.expenses > 0 ? (c.amount / data.expenses) * 100 : 0;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone-300">{c.category}</span>
                      <span className="text-stone-400">{formatFCFA(c.amount)}</span>
                    </div>
                    <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div className="h-full bg-error-500/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
