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

/** Agrège sorties + bénéfice brut depuis les rapports journaliers (notes JSON). */
export async function loadBeverageProfitFromReports(
  establishmentId: string,
  sinceISO: string
): Promise<BeveragePeriodReport> {
  const { data: reports } = await supabase
    .from('daily_reports')
    .select('date, notes, total_sales')
    .eq('establishment_id', establishmentId)
    .gte('date', sinceISO.slice(0, 10))
    .order('date', { ascending: false });

  // coûts / prix actuels produits (fallback)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, cost, price')
    .eq('establishment_id', establishmentId);

  const costMap = new Map<string, number>();
  const priceMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const p of products || []) {
    costMap.set(p.id, Number(p.cost) || 0);
    priceMap.set(p.id, Number(p.price) || 0);
    nameMap.set(p.id, p.name);
  }

  const agg = new Map<string, BeverageLineProfit>();

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
      const name = it.name || nameMap.get(id) || 'Boisson';
      const cur = agg.get(id) || {
        product_id: id,
        name,
        qty_out: 0,
        ca: 0,
        cost: 0,
        profit: 0,
      };
      cur.qty_out += qty;
      cur.ca += qty * unitPrice;
      cur.cost += qty * unitCost;
      cur.profit = cur.ca - cur.cost;
      agg.set(id, cur);
    }
  }

  const lines = Array.from(agg.values()).sort((a, b) => b.profit - a.profit);
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
