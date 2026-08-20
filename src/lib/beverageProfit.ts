import { supabase } from '@/lib/supabase';

export type BeverageLineProfit = {
  product_id: string;
  name: string;
  qty_out: number;
  ca: number;
  cost: number;
  profit: number;
};

export type BeveragePeriodReport = {
  lines: BeverageLineProfit[];
  totalQty: number;
  totalCA: number;
  totalCost: number;
  totalProfit: number;
};

type ReportItem = { product_id?: string; name?: string; price?: number; qty?: number; cost?: number };


/** Agrège sorties + bénéfice brut : ventes caisse + rapports journaliers (sans double compter la même qté). */
export async function loadBeverageProfitFromReports(
  establishmentId: string,
  sinceISO: string
): Promise<BeveragePeriodReport> {
  const sinceDate = sinceISO.slice(0, 10);
  const sinceTs = sinceISO.length === 10 ? `${sinceISO}T00:00:00.000Z` : sinceISO;

  const [{ data: reports }, { data: products }, { data: sales }] = await Promise.all([
    supabase
      .from('daily_reports')
      .select('date, notes, total_sales')
      .eq('establishment_id', establishmentId)
      .gte('date', sinceDate)
      .order('date', { ascending: false }),
    supabase.from('products').select('id, name, cost, price').eq('establishment_id', establishmentId),
    supabase
      .from('sales')
      .select('product_id, qty, unit_price, total, created_at')
      .eq('establishment_id', establishmentId)
      .gte('created_at', sinceTs),
  ]);

  const costMap = new Map<string, number>();
  const priceMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const p of products || []) {
    costMap.set(p.id, Number(p.cost) || 0);
    priceMap.set(p.id, Number(p.price) || 0);
    nameMap.set(p.id, p.name);
  }

  type Acc = { qty: number; ca: number; cost: number; name: string };
  const fromSales = new Map<string, Acc>();
  const fromReports = new Map<string, Acc>();

  for (const s of sales || []) {
    const id = String(s.product_id || '');
    if (!id) continue;
    const qty = Math.max(0, Math.floor(Number(s.qty) || 0));
    if (!qty) continue;
    const unitPrice = Number(s.unit_price) || (Number(s.total) || 0) / qty || priceMap.get(id) || 0;
    const unitCost = costMap.get(id) || 0;
    const cur = fromSales.get(id) || { qty: 0, ca: 0, cost: 0, name: nameMap.get(id) || 'Boisson' };
    cur.qty += qty;
    cur.ca += qty * unitPrice;
    cur.cost += qty * unitCost;
    fromSales.set(id, cur);
  }

  for (const r of reports || []) {
    let items: ReportItem[] = [];
    const raw = r.notes || '';
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as { items?: ReportItem[] };
        items = parsed.items || [];
      } catch {
        items = [];
      }
    }
    for (const it of items) {
      const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
      if (!qty) continue;
      const id = String(it.product_id || it.name || 'unknown');
      const unitPrice = Number(it.price) || priceMap.get(id) || 0;
      const unitCost = Number(it.cost) || costMap.get(id) || 0;
      const cur = fromReports.get(id) || {
        qty: 0,
        ca: 0,
        cost: 0,
        name: it.name || nameMap.get(id) || 'Boisson',
      };
      cur.qty += qty;
      cur.ca += qty * unitPrice;
      cur.cost += qty * unitCost;
      fromReports.set(id, cur);
    }
  }

  // Fusion : pour chaque produit, on prend la source avec le plus de sorties (évite caisse + même rapport)
  const ids = new Set([...fromSales.keys(), ...fromReports.keys()]);
  const lines: BeverageLineProfit[] = [];
  for (const id of ids) {
    const a = fromSales.get(id);
    const b = fromReports.get(id);
    const pick = !a ? b! : !b ? a : a.qty >= b.qty ? a : b;
    lines.push({
      product_id: id,
      name: pick.name,
      qty_out: pick.qty,
      ca: pick.ca,
      cost: pick.cost,
      profit: pick.ca - pick.cost,
    });
  }
  lines.sort((x, y) => y.profit - x.profit);
  const totalQty = lines.reduce((s, l) => s + l.qty_out, 0);
  const totalCA = lines.reduce((s, l) => s + l.ca, 0);
  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  return {
    lines,
    totalQty,
    totalCA,
    totalCost,
    totalProfit: totalCA - totalCost,
  };
}

export function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function monthStartISO(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
