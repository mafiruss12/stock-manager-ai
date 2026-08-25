import { useEffect, useState } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, Wallet, ArrowUpRight, DollarSign, FileText, Package,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA, todayISO, daysAgoISO } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';

interface PeriodData {
  sales: number;
  salesFromReports: number;
  salesFromPos: number;
  expenses: number;
  purchases: number;
  profit: number;
  cashSales: number;
  mobileSales: number;
  reportsCount: number;
  categoryBreakdown: { category: string; amount: number }[];
}

export default function Accounting() {
  const { member, effectiveRole } = useAuth();
  const estId = useEstId();
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(String(effectiveRole || member?.role || ''));
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [data, setData] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!estId) {
        setLoading(false);
        setData(null);
        return;
      }
      setLoading(true);

      let startDate: string;
      let startDay: string;
      switch (period) {
        case 'today':
          startDate = `${todayISO()}T00:00:00`;
          startDay = todayISO();
          break;
        case 'week':
          startDate = daysAgoISO(7);
          startDay = daysAgoISO(7).slice(0, 10);
          break;
        case 'year':
          startDate = daysAgoISO(365);
          startDay = daysAgoISO(365).slice(0, 10);
          break;
        default: {
          const d = new Date();
          const first = new Date(d.getFullYear(), d.getMonth(), 1);
          startDate = first.toISOString();
          startDay = first.toISOString().slice(0, 10);
        }
      }

      const [salesRes, expensesRes, purchasesRes, reportsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total, payment_method, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', startDate),
        supabase
          .from('expenses')
          .select('amount, category, created_at')
          .eq('establishment_id', estId)
          .gte('created_at', startDate),
        supabase
          .from('purchases')
          .select('total, status, created_at, notes')
          .eq('establishment_id', estId)
          .gte('created_at', startDate),
        supabase
          .from('daily_reports')
          .select('date, total_sales, total_expenses, cash, mobile_money, sent_at')
          .eq('establishment_id', estId)
          .gte('date', startDay),
      ]);

      const posSalesRows = salesRes.data ?? [];
      const salesFromPos = posSalesRows.reduce((s, r) => s + Number(r.total || 0), 0);

      const reports = (reportsRes.data ?? []).filter((r) => r.sent_at || Number(r.total_sales) > 0);
      const salesFromReports = reports.reduce((s, r) => s + Number(r.total_sales || 0), 0);
      const reportExpenses = reports.reduce((s, r) => s + Number(r.total_expenses || 0), 0);

      // Ventes = max logique : rapports journaliers (source principale maquis) + POS si non déjà inclus
      // On additionne les deux sources (POS caisse + rapports) — en pratique maquis utilise surtout les rapports
      const sales = salesFromReports + salesFromPos;

      const cashFromReports = reports.reduce((s, r) => s + Number(r.cash || 0), 0);
      const mobileFromReports = reports.reduce((s, r) => s + Number(r.mobile_money || 0), 0);
      const cashFromPos = posSalesRows
        .filter((r) => {
          const m = String(r.payment_method || '').toLowerCase();
          return m.includes('cash') || m.includes('espece');
        })
        .reduce((s, r) => s + Number(r.total || 0), 0);
      const mobileFromPos = posSalesRows
        .filter((r) => {
          const m = String(r.payment_method || '').toLowerCase();
          return m.includes('mobile') || m.includes('wave') || m.includes('orange') || m.includes('mtn');
        })
        .reduce((s, r) => s + Number(r.total || 0), 0);

      const cashSales = cashFromReports + cashFromPos;
      const mobileSales = mobileFromReports + mobileFromPos;

      const expenseRows = expensesRes.data ?? [];
      const expensesFromTable = expenseRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const expenses = expensesFromTable + reportExpenses;

      // Achats = tous les reçus (arrivages stock inclus status received ou sans filtre strict)
      const purchaseRows = (purchasesRes.data ?? []).filter(
        (r) => !r.status || r.status === 'received' || r.status === 'paid' || r.status === 'completed'
      );
      const purchases = purchaseRows.reduce((s, r) => s + Number(r.total || 0), 0);

      // Bénéfice net = Ventes − Achats (stock) − Dépenses
      const profit = sales - purchases - expenses;

      const catMap: Record<string, number> = {};
      for (const e of expenseRows) {
        const cat = e.category || 'Divers';
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
      }
      if (reportExpenses > 0) {
        catMap['Dépenses (rapports)'] = (catMap['Dépenses (rapports)'] || 0) + reportExpenses;
      }
      const categoryBreakdown = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      setData({
        sales,
        salesFromReports,
        salesFromPos,
        expenses,
        purchases,
        profit,
        cashSales,
        mobileSales,
        reportsCount: reports.length,
        categoryBreakdown,
      });
      setLoading(false);
    })();
  }, [estId, period]);

  if (!canSeeFinance) {
    return (
      <EmptyState
        icon={<Calculator size={40} />}
        title="Comptabilité réservée"
        message="Seuls le propriétaire et l’administrateur voient la comptabilité."
      />
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Calculator size={40} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour voir la comptabilité."
      />
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement…</div>;
  }

  if (!data) {
    return (
      <EmptyState
        icon={<Calculator size={40} />}
        title="Aucune donnée"
        message="Pas encore de mouvements comptables."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Calculator className="text-amber-400" size={26} /> Comptabilité
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Ventes (rapports + caisse) − achats stock − dépenses = bénéfice net
          </p>
        </div>
        <div className="flex gap-1 bg-stone-900 rounded-xl p-1 border border-stone-800">
          {([
            ['today', 'Jour'],
            ['week', 'Semaine'],
            ['month', 'Mois'],
            ['year', 'Année'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPeriod(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                period === k ? 'bg-amber-500/20 text-amber-200' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Ventes"
          value={formatFCFA(data.sales)}
          icon={<TrendingUp size={22} />}
          accent="primary"
        />
        <StatCard
          label="Achats (stock)"
          value={formatFCFA(data.purchases)}
          icon={<Package size={22} />}
          accent="warning"
        />
        <StatCard
          label="Dépenses"
          value={formatFCFA(data.expenses)}
          icon={<TrendingDown size={22} />}
          accent="error"
        />
        <StatCard
          label="Bénéfice net"
          value={`${data.profit < 0 ? '− ' : ''}${formatFCFA(Math.abs(data.profit))}`}
          icon={<ArrowUpRight size={22} />}
          accent={data.profit >= 0 ? 'primary' : 'error'}
        />
      </div>

      <div className="card text-sm text-stone-400 space-y-1 border border-stone-800">
        <p className="text-stone-300 font-medium flex items-center gap-2">
          <FileText size={16} className="text-amber-400" /> Détail du calcul
        </p>
        <p>
          Ventes rapports journaliers : <strong className="text-stone-200">{formatFCFA(data.salesFromReports)}</strong>
          {' '}({data.reportsCount} rapport{data.reportsCount > 1 ? 's' : ''})
        </p>
        <p>
          Ventes caisse (POS) : <strong className="text-stone-200">{formatFCFA(data.salesFromPos)}</strong>
        </p>
        <p>
          Achats / arrivages stock : <strong className="text-stone-200">{formatFCFA(data.purchases)}</strong>
        </p>
        <p>
          Dépenses : <strong className="text-stone-200">{formatFCFA(data.expenses)}</strong>
        </p>
        <p className="pt-1 border-t border-stone-800 text-stone-300">
          Bénéfice = {formatFCFA(data.sales)} − {formatFCFA(data.purchases)} − {formatFCFA(data.expenses)} ={' '}
          <strong className={data.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            {formatFCFA(data.profit)}
          </strong>
        </p>
        {data.profit < 0 && (
          <p className="text-amber-200/90 text-xs">
            Un bénéfice négatif est normal si vous avez beaucoup d’arrivages stock (achats) sur la période
            par rapport aux ventes déjà rapportées.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4">Encaissements</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-2">
                <DollarSign size={16} className="text-secondary-400" /> Espèces (rapports + caisse)
              </span>
              <span className="font-bold text-stone-200">{formatFCFA(data.cashSales)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 flex items-center gap-2">
                <Wallet size={16} className="text-primary-400" /> Mobile Money
              </span>
              <span className="font-bold text-stone-200">{formatFCFA(data.mobileSales)}</span>
            </div>
            <div className="border-t border-stone-800 pt-3 flex items-center justify-between">
              <span className="text-stone-400">Total ventes période</span>
              <span className="font-bold text-primary-400">{formatFCFA(data.sales)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4">Dépenses par catégorie</h2>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-stone-500">
              Aucune dépense saisie. Les arrivages stock apparaissent dans « Achats », pas ici.
            </p>
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
                      <div className="h-full bg-error-500/60 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
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
