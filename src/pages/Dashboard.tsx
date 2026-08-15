import { useEffect, useState } from 'react';
import {
  TrendingUp, DollarSign, Package, Users, AlertTriangle, Receipt, ShoppingCart,
  UtensilsCrossed, LayoutDashboard, Truck, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatFCFA, todayISO } from '@/lib/format';
import { StatCard, EmptyState } from '@/components/ui';
import { BarChart, Sparkline } from '@/components/MiniChart';
import {
  normalizeBusinessType,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  type BusinessType,
  getBusinessUI,
} from '@/lib/businessTypes';
import type { Sale, Order } from '@/lib/types';

interface DashboardData {
  todaySales: number;
  todayExpenses: number;
  todayProfit: number;
  weekSalesTotal: number;
  lowStockCount: number;
  employeeCount: number;
  activeOrders: number;
  freeTables: number;
  occupiedTables: number;
  weeklyData: { label: string; value: number }[];
  weekValues: number[];
  recentSales: Sale[];
  activeOrdersList: Order[];
  topProducts: { name: string; revenue: number }[];
  aiAlerts: string[];
  dataPartial: boolean;
}

export default function Dashboard() {
  const { member, activeEstablishment } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bizType: BusinessType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const ui = getBusinessUI(bizType);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!member?.establishment_id) {
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const estId = member.establishment_id;
      try {
      const today = todayISO();

      const [salesRes, expensesRes, productsRes, employeesRes, ordersRes, recentRes, tablesRes, weekSalesRes] =
        await Promise.all([
          supabase.from('sales').select('total').eq('establishment_id', estId).gte('created_at', today),
          supabase.from('expenses').select('amount').eq('establishment_id', estId).gte('created_at', today),
          supabase.from('products').select('id, stock, min_stock, name').eq('establishment_id', estId),
          supabase.from('employees').select('id').eq('establishment_id', estId).eq('status', 'active'),
          supabase.from('orders').select('*').eq('establishment_id', estId).in('status', ['pending', 'preparing', 'ready']),
          supabase.from('sales').select('*').eq('establishment_id', estId).order('created_at', { ascending: false }).limit(5),
          supabase.from('restaurant_tables').select('status').eq('establishment_id', estId),
          supabase.from('sales').select('total, created_at, product_id').eq('establishment_id', estId).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        ]);

      const queryErrors = [salesRes, expensesRes, productsRes, weekSalesRes]
        .map((r) => r.error?.message)
        .filter(Boolean);
      const dataPartial = queryErrors.length > 0;
      if (dataPartial) {
        setError(`Données partielles : ${queryErrors[0]}`);
      }

      const todaySales = (salesRes.data ?? []).reduce((s, x) => s + Number(x.total), 0);
      const todayExpenses = (expensesRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const products = productsRes.data ?? [];
      const lowStockItems = products.filter((p) => Number(p.stock) <= Number(p.min_stock));
      const lowStock = lowStockItems.length;
      const tables = tablesRes.data ?? [];
      const freeTables = tables.filter((t) => t.status === 'free').length;
      const occupiedTables = tables.filter((t) => t.status === 'occupied').length;

      const toLocalDay = (iso: string) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const weeklyData: { label: string; value: number }[] = [];
      const weekValues: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() - i);
        const dayStr = toLocalDay(date.toISOString());
        const label = date.toLocaleDateString('fr-FR', { weekday: 'short' });
        const sum = (weekSalesRes.data ?? [])
          .filter((s) => s.created_at && toLocalDay(s.created_at) === dayStr)
          .reduce((a, b) => a + Number(b.total), 0);
        weeklyData.push({ label, value: sum });
        weekValues.push(sum);
      }
      const weekSalesTotal = weekValues.reduce((a, b) => a + b, 0);

      const aiAlerts: string[] = [];
      for (const p of lowStockItems.slice(0, 5)) {
        const st = Number(p.stock);
        const min = Number(p.min_stock) || 1;
        if (st <= 0) aiAlerts.push(`Rupture : ${p.name}`);
        else aiAlerts.push(`Stock bas : ${p.name} (${st} restant, seuil ${min})`);
      }
      if (weekSalesTotal > 0 && todaySales === 0) {
        aiAlerts.push('Aucune vente enregistrée aujourd\'hui alors que la semaine est active.');
      }
      if (todayExpenses > todaySales && todaySales > 0) {
        aiAlerts.push('Dépenses du jour supérieures aux ventes — marge négative.');
      }

      const prodRev: Record<string, number> = {};
      for (const s of weekSalesRes.data ?? []) {
        if (s.product_id) prodRev[s.product_id] = (prodRev[s.product_id] ?? 0) + Number(s.total);
      }
      const topProducts = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, revenue]) => ({
        name: (productsRes.data ?? []).find((p) => p.id === id)?.name ?? 'Produit',
        revenue,
      }));

      if (!cancelled) {
        setData({
          todaySales, todayExpenses, todayProfit: todaySales - todayExpenses,
          weekSalesTotal, lowStockCount: lowStock,
          employeeCount: employeesRes.data?.length ?? 0, activeOrders: ordersRes.data?.length ?? 0,
          freeTables, occupiedTables, weeklyData, weekValues,
          recentSales: (recentRes.data ?? []) as Sale[],
          activeOrdersList: (ordersRes.data ?? []) as Order[],
          topProducts,
          aiAlerts,
          dataPartial,
        });
      }
      } catch (e) {
        setError("Impossible de charger le tableau de bord");
        console.error(e);
        if (!cancelled) {
          setData({
            todaySales: 0, todayExpenses: 0, todayProfit: 0, weekSalesTotal: 0, lowStockCount: 0,
            employeeCount: 0, activeOrders: 0, freeTables: 0, occupiedTables: 0,
            weeklyData: [], weekValues: [], recentSales: [], activeOrdersList: [], topProducts: [],
            aiAlerts: [], dataPartial: true,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [member?.establishment_id]);

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) {
    return <EmptyState icon={<LayoutDashboard size={48} />} title="Aucun établissement" message="Créez votre activité dans Paramètres." />;
  }
  if (!data) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement du tableau de bord…</div>;

  const shortcuts =
    bizType === 'restaurant' ? [
      { to: '/orders', label: 'Commandes', icon: Receipt },
      { to: '/kitchen', label: 'Cuisine', icon: UtensilsCrossed },
      { to: '/tables', label: 'Tables', icon: LayoutDashboard },
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
    ] : bizType === 'bar' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/orders', label: 'Commandes', icon: Receipt },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/daily-report', label: 'Clôture', icon: TrendingUp },
    ] : bizType === 'pharmacie' ? [
      { to: '/pos', label: 'Caisse pharmacie', icon: ShoppingCart },
      { to: '/inventory', label: 'Médicaments', icon: Package },
      { to: '/purchases', label: 'Approvisionnement', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'quincaillerie' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: 'Matériaux', icon: Package },
      { to: '/purchases', label: 'Achats', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'boutique' || bizType === 'superette' || bizType === 'magasin' || bizType === 'commerce' ? [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/purchases', label: 'Achats', icon: Truck },
      { to: '/suppliers', label: 'Fournisseurs', icon: Truck },
    ] : bizType === 'location_event' ? [
      { to: '/rent/equipment', label: 'Matériel', icon: Package },
      { to: '/rent/orders', label: 'Commandes', icon: Receipt },
      { to: '/rent/calendar', label: 'Calendrier', icon: LayoutDashboard },
      { to: '/rent/clients', label: 'Clients', icon: Users },
    ] : [
      { to: '/pos', label: ui.posTitle, icon: ShoppingCart },
      { to: '/inventory', label: ui.shortcutInventory, icon: Package },
      { to: '/expenses', label: 'Dépenses', icon: DollarSign },
      { to: '/daily-report', label: 'Clôture', icon: TrendingUp },
    ];

  return (
    <div>
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 mb-3">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>Mode {BUSINESS_LABELS[bizType]}</p>
          <h1 className="text-2xl font-bold font-display text-stone-100">{activeEstablishment?.name ?? 'Tableau de bord'}</h1>
          <p className="text-stone-400 text-sm">Vue d&apos;évolution de votre activité</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: theme.primarySoft, color: theme.primary }}>
          <Sparkline values={data.weekValues} color={theme.primary} />
          7 jours
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard title="Ventes du jour" value={formatFCFA(data.todaySales)} icon={<DollarSign size={20} />} />
        <StatCard title="CA 7 jours" value={formatFCFA(data.weekSalesTotal)} icon={<TrendingUp size={20} />} />
        <StatCard title="Dépenses du jour" value={formatFCFA(data.todayExpenses)} icon={<DollarSign size={20} />} />
        <StatCard title="Bénéfice jour" value={formatFCFA(data.todayProfit)} icon={<TrendingUp size={20} />} />
        {(bizType === 'restaurant' || bizType === 'bar') && (
          <StatCard title="Commandes actives" value={String(data.activeOrders)} icon={<Receipt size={20} />} />
        )}
        {bizType === 'restaurant' && (
          <StatCard title="Tables" value={`${data.occupiedTables}/${data.occupiedTables + data.freeTables}`} icon={<LayoutDashboard size={20} />} />
        )}
        {(bizType === 'maquis' || bizType === 'magasin') && (
          <StatCard title={ui.stockAlert} value={String(data.lowStockCount)} icon={<AlertTriangle size={20} />} />
        )}
        {bizType === 'magasin' && (
          <StatCard title="Employés" value={String(data.employeeCount)} icon={<Users size={20} />} />
        )}
        {bizType === 'maquis' && (
          <StatCard title="Résultat jour" value={formatFCFA(data.todayProfit)} icon={<TrendingUp size={20} />} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {shortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.to} to={s.to} className="card flex items-center gap-3 hover:border-stone-600 transition-all">
              <div className="p-2 rounded-xl" style={{ background: theme.primarySoft, color: theme.primary }}><Icon size={18} /></div>
              <span className="font-medium text-stone-200 text-sm">{s.label}</span>
              <ArrowRight size={14} className="ml-auto text-stone-600" />
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className={`card bg-gradient-to-br ${theme.gradient}`}>
          <h2 className="font-semibold text-stone-100 mb-1">Évolution des ventes (7 j)</h2>
          <p className="text-xs text-stone-500 mb-3">Graphique {BUSINESS_LABELS[bizType]}</p>
          <BarChart data={data.weeklyData} color={theme.primary} height={140} />
        </div>
        <div className="card">
          <h2 className="font-semibold text-stone-100 mb-3">{bizType === 'restaurant' ? 'Commandes en cours' : 'Top produits (7 j)'}</h2>
          {bizType === 'restaurant' && data.activeOrdersList.length > 0 ? (
            <ul className="space-y-2">
              {data.activeOrdersList.slice(0, 5).map((o) => (
                <li key={o.id} className="flex justify-between text-sm text-stone-300">
                  <span>Table {o.table_number ?? '—'} · {o.status}</span>
                  <span className="font-medium">{formatFCFA(Number(o.total))}</span>
                </li>
              ))}
            </ul>
          ) : data.topProducts.length > 0 ? (
            <ul className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-stone-300">{p.name}</span>
                  <span className="font-medium" style={{ color: theme.primary }}>{formatFCFA(p.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Pas encore assez de données.</p>
          )}
        </div>
      </div>

      
      {data.aiAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-200">Alertes IA — Stock Manager</p>
          <ul className="space-y-1">
            {data.aiAlerts.map((a, i) => (
              <li key={i} className="text-sm text-amber-100/90">⚠️ {a}</li>
            ))}
          </ul>
        </div>
      )}

      {data.lowStockCount > 0 && (
        <div className="card border border-warning-500/30 bg-warning-500/5 flex items-start gap-3">
          <AlertTriangle className="text-warning-400 shrink-0" size={20} />
          <div>
            <p className="font-medium text-stone-100">{data.lowStockCount} produit(s) sous le seuil</p>
            <Link to="/inventory" className="text-sm text-primary-400 hover:underline">Voir l&apos;inventaire →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
