import { supabase } from '@/lib/supabase';
import { isOnline, queueAdd } from '@/lib/offline';
import { addTicket } from '@/lib/liveDaySales';
import type { LivePayMethod } from '@/lib/liveDaySales';

export type ClosePay = 'cash' | 'mobile' | 'mixed';

type OrderLine = {
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
};

/** Agrège les lignes de plusieurs commandes */
export function aggregateOrderLines(lines: OrderLine[]) {
  const map = new Map<string, OrderLine & { key: string }>();
  for (const l of lines) {
    const key = l.product_id || `name:${l.product_name}`;
    const cur = map.get(key);
    if (cur) cur.qty += l.qty;
    else map.set(key, { ...l, key });
  }
  return Array.from(map.values());
}

/**
 * Clôture table / commandes :
 * - paiement
 * - statut served
 * - décrément stock une fois
 * - table libre
 * - option : pousser vers ventes journée
 */
export async function closeTableOrders(opts: {
  establishmentId: string;
  orderIds: string[];
  tableId?: string | null;
  payment: ClosePay;
  paidAmount: number;
  pushToLiveSales?: boolean;
  productsCost?: Record<string, number>;
}): Promise<{ ok: boolean; error?: string }> {
  const { establishmentId, orderIds, tableId, payment, paidAmount, pushToLiveSales } = opts;
  if (!orderIds.length) return { ok: false, error: 'Aucune commande' };

  const { data: items, error: iErr } = await supabase
    .from('order_items')
    .select('order_id, product_id, product_name, qty, unit_price')
    .in('order_id', orderIds);
  if (iErr) return { ok: false, error: iErr.message };

  const lines = (items || []) as OrderLine[];
  const agg = aggregateOrderLines(lines);

  // Décrément stock (une fois par produit)
  for (const line of agg) {
    if (!line.product_id) continue;
    const { data: prod } = await supabase
      .from('products')
      .select('id, stock')
      .eq('id', line.product_id)
      .maybeSingle();
    if (!prod) continue;
    const prev = Math.floor(Number(prod.stock) || 0);
    const next = Math.max(0, prev - line.qty);
    if (!isOnline()) {
      await queueAdd('products', 'update', { stock: next, _prev_stock: prev }, { id: line.product_id });
    } else {
      await supabase.from('products').update({ stock: next }).eq('id', line.product_id);
    }
  }

  const paidAt = new Date().toISOString();
  for (const oid of orderIds) {
    await supabase
      .from('orders')
      .update({
        status: 'served',
        payment_method: payment,
        paid_at: paidAt,
        paid_amount: paidAmount,
        stock_deducted: true,
      })
      .eq('id', oid);
    await supabase.from('order_items').update({ status: 'served' }).eq('order_id', oid);
  }

  if (tableId) {
    await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', tableId);
  }

  if (pushToLiveSales && agg.length) {
    const date = paidAt.slice(0, 10);
    const liveLines = agg
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id as string,
        name: l.product_name,
        price: Math.round(Number(l.unit_price) || 0),
        cost: opts.productsCost?.[l.product_id as string] || 0,
        qty: l.qty,
      }));
    if (liveLines.length) {
      addTicket(establishmentId, date, liveLines, payment as LivePayMethod, 'Clôture table QR');
    }
  }

  return { ok: true };
}
