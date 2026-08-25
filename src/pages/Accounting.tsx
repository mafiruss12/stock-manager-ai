import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, TrendingUp, TrendingDown, Package, FileText, ChevronDown, ChevronUp,
  Calendar, Printer, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import { formatFCFA, todayISO } from '@/lib/format';
import { EmptyState } from '@/components/ui';

type DaySales = { date: string; sales: number; cash: number; mobile: number };
type WeekBlock = {
  weekKey: string; label: string; monday: string; sunday: string;
  days: DaySales[]; sales: number; purchases: number; expenses: number; profit: number;
};
type MonthBlock = {
  monthKey: string; label: string; sales: number; purchases: number; expenses: number; profit: number; weeks: WeekBlock[];
};

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(12, 0, 0, 0);
  return d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatFr(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function Accounting() {
  const { member, effectiveRole, activeEstablishment } = useAuth();
  const estId = useEstId();
  const canSeeFinance = ['super_admin', 'admin', 'owner'].includes(String(effectiveRole || member?.role || ''));
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState<WeekBlock[]>([]);
  const [months, setMonths] = useState<MonthBlock[]>([]);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [view, setView] = useState<'weeks' | 'months'>('weeks');

  const load = useCallback(async () => {
    if (!estId) { setLoading(false); return; }
    setLoading(true);
    const today = todayISO();
    const startMon = mondayOf(today);
    startMon.setDate(startMon.getDate() - 7 * 15);
    const fromDay = toISODate(startMon);

    const [reportsRes, purchasesRes, expensesRes] = await Promise.all([
      supabase.from('daily_reports').select('date, total_sales, total_expenses, cash, mobile_money, sent_at').eq('establishment_id', estId).gte('date', fromDay).order('date', { ascending: true }),
      supabase.from('purchases').select('total, status, created_at, notes').eq('establishment_id', estId).gte('created_at', fromDay + 'T00:00:00'),
      supabase.from('expenses').select('amount, category, created_at').eq('establishment_id', estId).gte('created_at', fromDay + 'T00:00:00'),
    ]);

    const reports = reportsRes.data ?? [];
    const purchases = (purchasesRes.data ?? []).filter((r) => !r.status || ['received', 'paid', 'completed'].includes(String(r.status)));
    const expenses = expensesRes.data ?? [];

    const salesByDay = new Map<string, DaySales>();
    for (const r of reports) {
      const date = String(r.date).slice(0, 10);
      const prev = salesByDay.get(date) || { date, sales: 0, cash: 0, mobile: 0 };
      prev.sales += Number(r.total_sales || 0);
      prev.cash += Number(r.cash || 0);
      prev.mobile += Number(r.mobile_money || 0);
      salesByDay.set(date, prev);
    }
    const purchByDay = new Map<string, number>();
    for (const p of purchases) {
      const date = String(p.created_at).slice(0, 10);
      purchByDay.set(date, (purchByDay.get(date) || 0) + Number(p.total || 0));
    }
    const expByDay = new Map<string, number>();
    for (const e of expenses) {
      const date = String(e.created_at).slice(0, 10);
      expByDay.set(date, (expByDay.get(date) || 0) + Number(e.amount || 0));
    }
    for (const r of reports) {
      const date = String(r.date).slice(0, 10);
      const te = Number(r.total_expenses || 0);
      if (te) expByDay.set(date, (expByDay.get(date) || 0) + te);
    }

    const weekList: WeekBlock[] = [];
    const cursor = mondayOf(today);
    for (let i = 0; i < 16; i++) {
      const mon = addDays(cursor, -7 * i);
      const monday = toISODate(mon);
      const sunday = toISODate(addDays(mon, 6));
      const days: DaySales[] = [];
      let sales = 0, purch = 0, exp = 0;
      for (let d = 0; d < 7; d++) {
        const iso = toISODate(addDays(mon, d));
        const daySales = salesByDay.get(iso) || { date: iso, sales: 0, cash: 0, mobile: 0 };
        days.push(daySales);
        sales += daySales.sales;
        purch += purchByDay.get(iso) || 0;
        exp += expByDay.get(iso) || 0;
      }
      const isCurrent = monday === toISODate(mondayOf(today));
      if (!isCurrent && sales === 0 && purch === 0 && exp === 0) continue;
      weekList.push({
        weekKey: monday,
        label: `Semaine du ${formatFr(monday)} au ${formatFr(sunday)}`,
        monday, sunday, days, sales, purchases: purch, expenses: exp, profit: sales - purch - exp,
      });
    }

    const monthMap = new Map<string, MonthBlock>();
    for (const w of weekList) {
      const thu = toISODate(addDays(new Date(w.monday + 'T12:00:00'), 3));
      const monthKey = thu.slice(0, 7);
      let m = monthMap.get(monthKey);
      if (!m) {
        m = { monthKey, label: monthLabel(monthKey), sales: 0, purchases: 0, expenses: 0, profit: 0, weeks: [] };
        monthMap.set(monthKey, m);
      }
      m.weeks.push(w);
      m.sales += w.sales;
      m.purchases += w.purchases;
      m.expenses += w.expenses;
      m.profit = m.sales - m.purchases - m.expenses;
    }
    const monthList = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    setWeeks(weekList);
    setMonths(monthList);
    if (weekList[0]) setOpenWeek(weekList[0].weekKey);
    if (monthList[0]) setOpenMonth(monthList[0].monthKey);
    setLoading(false);
  }, [estId]);

  useEffect(() => { void load(); }, [load]);
  const currentMonth = useMemo(() => months[0] || null, [months]);

  function printMonthReport(m: MonthBlock) {
    const estName = activeEstablishment?.name || 'Établissement';
    const rows = m.weeks.map((w) =>
      `<tr><td style="padding:8px;border:1px solid #ddd">${w.label}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatFCFA(w.sales)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatFCFA(w.purchases)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatFCFA(w.expenses)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${w.profit >= 0 ? '#047857' : '#b91c1c'}">${formatFCFA(w.profit)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${m.label}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px}h1{color:#b45309}table{border-collapse:collapse;width:100%;margin-top:16px}th{background:#fef3c7;padding:8px;border:1px solid #ddd;text-align:left}</style></head><body>
<h1>Rapport mensuel — ${m.label}</h1>
<p><strong>${estName}</strong> · ${new Date().toLocaleString('fr-FR')}</p>
<p>Ventes ${formatFCFA(m.sales)} · Achats ${formatFCFA(m.purchases)} · Dépenses ${formatFCFA(m.expenses)}</p>
<p style="font-size:1.25rem">Bénéfice net : <strong style="color:${m.profit >= 0 ? '#047857' : '#b91c1c'}">${formatFCFA(m.profit)}</strong></p>
<table><thead><tr><th>Semaine lun→dim</th><th>Ventes</th><th>Achats</th><th>Dépenses</th><th>Bénéfice</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:24px;font-size:12px;color:#666">Stock Manager AI · Kevin Tech Pro</p>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  }

  if (!canSeeFinance) return <EmptyState icon={<Calculator size={40} />} title="Comptabilité réservée" message="Réservée au propriétaire / administrateur." />;
  if (!estId) return <EmptyState icon={<Calculator size={40} />} title="Aucun établissement" message="Sélectionnez un établissement." />;
  if (loading) return <div className="flex justify-center py-20 text-stone-400">Chargement…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Calculator className="text-amber-400" size={26} /> Comptabilité
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Semaines <strong className="text-stone-300">lundi → dimanche</strong> · ventes (rapports) · achats · bénéfice
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs flex items-center gap-1" onClick={() => void load()}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {currentMonth && (
        <div className="card border border-amber-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-amber-400/90">Rapport mensuel automatique</p>
              <h2 className="text-lg font-semibold text-stone-100 capitalize">{currentMonth.label}</h2>
            </div>
            <button type="button" className="btn-secondary text-xs flex items-center gap-1" onClick={() => printMonthReport(currentMonth)}>
              <Printer size={14} /> Imprimer / PDF
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="rounded-xl bg-stone-900/80 p-3"><p className="text-[11px] text-stone-500">Ventes</p><p className="font-bold text-emerald-300">{formatFCFA(currentMonth.sales)}</p></div>
            <div className="rounded-xl bg-stone-900/80 p-3"><p className="text-[11px] text-stone-500">Achats stock</p><p className="font-bold text-amber-200">{formatFCFA(currentMonth.purchases)}</p></div>
            <div className="rounded-xl bg-stone-900/80 p-3"><p className="text-[11px] text-stone-500">Dépenses</p><p className="font-bold text-red-300">{formatFCFA(currentMonth.expenses)}</p></div>
            <div className="rounded-xl bg-stone-900/80 p-3"><p className="text-[11px] text-stone-500">Bénéfice net</p><p className={`font-bold ${currentMonth.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatFCFA(currentMonth.profit)}</p></div>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-stone-900 rounded-xl p-1 border border-stone-800 w-fit">
        <button type="button" className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === 'weeks' ? 'bg-amber-500/20 text-amber-200' : 'text-stone-400'}`} onClick={() => setView('weeks')}>Par semaine</button>
        <button type="button" className={`px-3 py-1.5 rounded-lg text-xs font-medium ${view === 'months' ? 'bg-amber-500/20 text-amber-200' : 'text-stone-400'}`} onClick={() => setView('months')}>Par mois</button>
      </div>

      {view === 'weeks' && (
        <div className="space-y-3">
          {weeks.length === 0 ? <p className="text-stone-500 text-sm">Aucune activité.</p> : weeks.map((w) => {
            const open = openWeek === w.weekKey;
            return (
              <div key={w.weekKey} className="card border border-stone-800">
                <button type="button" className="w-full flex items-center gap-2 text-left" onClick={() => setOpenWeek(open ? null : w.weekKey)}>
                  <Calendar size={16} className="text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 text-sm truncate">{w.label}</p>
                    <p className="text-xs text-stone-500">Ventes {formatFCFA(w.sales)} · Achats {formatFCFA(w.purchases)} · Bénéfice <span className={w.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatFCFA(w.profit)}</span></p>
                  </div>
                  {open ? <ChevronUp size={18} className="text-stone-500" /> : <ChevronDown size={18} className="text-stone-500" />}
                </button>
                {open && (
                  <div className="mt-3 pt-3 border-t border-stone-800 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-stone-900 p-2"><p className="text-stone-500">Ventes</p><p className="font-semibold text-emerald-300">{formatFCFA(w.sales)}</p></div>
                      <div className="rounded-lg bg-stone-900 p-2"><p className="text-stone-500">Achats</p><p className="font-semibold text-amber-200">{formatFCFA(w.purchases)}</p></div>
                      <div className="rounded-lg bg-stone-900 p-2"><p className="text-stone-500">Bénéfice</p><p className={`font-semibold ${w.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatFCFA(w.profit)}</p></div>
                    </div>
                    <p className="text-[11px] text-stone-500 uppercase">Ventes par jour (rapports lun→dim)</p>
                    <ul className="space-y-1">
                      {w.days.map((d) => {
                        const dayName = new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
                        return (
                          <li key={d.date} className="flex justify-between text-sm border-b border-stone-800/80 py-1.5">
                            <span className="text-stone-400 capitalize">{dayName}</span>
                            <span className={d.sales > 0 ? 'text-stone-100 font-medium' : 'text-stone-600'}>{d.sales > 0 ? formatFCFA(d.sales) : '—'}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-stone-500">Différence = ventes − achats − dépenses ({formatFCFA(w.expenses)})</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'months' && (
        <div className="space-y-3">
          {months.map((m) => {
            const open = openMonth === m.monthKey;
            return (
              <div key={m.monthKey} className="card border border-stone-800">
                <button type="button" className="w-full flex items-center gap-2 text-left" onClick={() => setOpenMonth(open ? null : m.monthKey)}>
                  <FileText size={16} className="text-amber-400" />
                  <div className="flex-1">
                    <p className="font-medium text-stone-100 capitalize">{m.label}</p>
                    <p className="text-xs text-stone-500">{formatFCFA(m.sales)} ventes · bénéfice <span className={m.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatFCFA(m.profit)}</span></p>
                  </div>
                  <button type="button" className="btn-ghost text-[10px] px-2 py-1" onClick={(e) => { e.stopPropagation(); printMonthReport(m); }}>PDF</button>
                  {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {open && (
                  <div className="mt-3 pt-3 border-t border-stone-800 space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-stone-900 p-2"><TrendingUp size={12} className="text-emerald-400 inline" /> Ventes<p className="font-bold text-stone-100">{formatFCFA(m.sales)}</p></div>
                      <div className="rounded-lg bg-stone-900 p-2"><Package size={12} className="text-amber-400 inline" /> Achats<p className="font-bold text-stone-100">{formatFCFA(m.purchases)}</p></div>
                      <div className="rounded-lg bg-stone-900 p-2"><TrendingDown size={12} className="text-red-400 inline" /> Dépenses<p className="font-bold text-stone-100">{formatFCFA(m.expenses)}</p></div>
                      <div className="rounded-lg bg-stone-900 p-2">Bénéfice<p className={`font-bold ${m.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatFCFA(m.profit)}</p></div>
                    </div>
                    {m.weeks.map((w) => (
                      <div key={w.weekKey} className="flex justify-between text-xs text-stone-400 py-1 border-b border-stone-800/50">
                        <span className="truncate mr-2">{w.label.replace('Semaine du ', '')}</span>
                        <span className={w.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatFCFA(w.profit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
