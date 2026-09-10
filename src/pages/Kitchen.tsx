import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UtensilsCrossed, CheckCircle2, Clock, ChefHat, Bell, Wallet, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Order, OrderItem } from '@/lib/types';
import { ORDER_STATUS_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';
import { closeTableOrders, type ClosePay } from '@/lib/tableClose';

interface OrderWithItems extends Order {
  items?: OrderItem[];
  payment_method?: string | null;
  stock_deducted?: boolean;
}

const ORDER_COLS =
  'id, establishment_id, table_id, table_number, status, order_type, total, notes, created_at, source, payment_method, stock_deducted';
const ITEM_COLS = 'id, order_id, product_id, product_name, qty, unit_price, status';

export default function Kitchen() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPending = useRef(0);
  const [closeFor, setCloseFor] = useState<OrderWithItems | null>(null);
  const [pay, setPay] = useState<ClosePay>('cash');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    const { data: ordData } = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('establishment_id', estId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!ordData) {
      setLoading(false);
      return;
    }

    const ids = (ordData as Order[]).map((o) => o.id);
    const itemsByOrder: Record<string, OrderItem[]> = {};
    if (ids.length) {
      const { data: allItems } = await supabase
        .from('order_items')
        .select(ITEM_COLS)
        .in('order_id', ids);
      for (const it of (allItems as OrderItem[]) || []) {
        (itemsByOrder[it.order_id] ||= []).push(it);
      }
    }
    const ordersWithItems = (ordData as OrderWithItems[]).map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));
    setOrders(ordersWithItems);

    const pend = ordersWithItems.filter((o) => o.status === 'pending').length;
    if (pend > prevPending.current && prevPending.current > 0) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.value = 0.05;
        o.start();
        o.stop(ctx.currentTime + 0.15);
      } catch {
        /* */
      }
      try {
        document.title = `(${pend}) Cuisine / Bar`;
      } catch {
        /* */
      }
    }
    prevPending.current = pend;
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
    if (!estId) return;

    const channel = supabase
      .channel(`kitchen-orders-${estId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${estId}`,
        },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          void load();
        },
      )
      .subscribe();

    // secours si realtime indisponible
    const interval = setInterval(() => void load(), 20000);
    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [estId, load]);

  async function advanceOrder(o: OrderWithItems) {
    const next: Record<string, string> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'ready', // clôture séparée
    };
    if (o.status === 'ready') {
      setCloseFor(o);
      setPay('cash');
      return;
    }
    await supabase.from('orders').update({ status: next[o.status] }).eq('id', o.id);
    if (o.items) {
      for (const item of o.items) {
        await supabase.from('order_items').update({ status: next[o.status] }).eq('id', item.id);
      }
    }
    await load();
  }

  async function confirmClose() {
    if (!closeFor || !estId) return;
    setBusy(true);
    setMsg(null);
    const res = await closeTableOrders({
      establishmentId: estId,
      orderIds: [closeFor.id],
      tableId: closeFor.table_id,
      payment: pay,
      paidAmount: Number(closeFor.total) || 0,
      pushToLiveSales: true,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error || 'Erreur clôture');
      return;
    }
    setCloseFor(null);
    setMsg('Table/commande clôturée · stock mis à jour · vente enregistrée');
    await load();
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-stone-400">Chargement cuisine…</div>;
  }

  const pending = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const ready = orders.filter((o) => o.status === 'ready').length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <ChefHat className="text-amber-400" /> Cuisine / Bar
        </h1>
        <span className="text-xs text-stone-500 flex items-center gap-1">
          <Bell size={12} /> Temps réel
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Nouvelles</p>
          <p className="text-xl font-bold text-amber-300">{pending}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Préparation</p>
          <p className="text-xl font-bold text-sky-300">{preparing}</p>
        </div>
        <div className="rounded-xl border border-stone-800 bg-stone-900/60 p-3 text-center">
          <p className="text-[10px] text-stone-500 uppercase">Prêtes</p>
          <p className="text-xl font-bold text-emerald-300">{ready}</p>
        </div>
      </div>

      {msg && (
        <p className="text-sm rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-stone-200">
          {msg}
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={48} />}
          title="Aucune commande en cours"
          message="Les commandes QR / table apparaîtront ici en direct."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`rounded-2xl border p-4 ${
                o.status === 'pending'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : o.status === 'preparing'
                    ? 'border-sky-500/40 bg-sky-500/5'
                    : 'border-emerald-500/40 bg-emerald-500/5'
              }`}
            >
              <div className="flex justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-stone-100">
                    Table {o.table_number || '—'}{' '}
                    <span className="text-xs font-normal text-stone-500">
                      {o.source === 'qr_table' ? '· QR client' : ''}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatTime(o.created_at)} · {ORDER_STATUS_LABELS[o.status] || o.status}
                  </p>
                </div>
                <Badge
                  color={
                    o.status === 'pending' ? 'warning' : o.status === 'preparing' ? 'primary' : 'success'
                  }
                >
                  {ORDER_STATUS_LABELS[o.status] || o.status}
                </Badge>
              </div>
              <ul className="text-sm text-stone-200 space-y-1 mb-3">
                {(o.items || []).map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span>
                      {it.product_name} × {it.qty}
                    </span>
                    <span className="font-mono text-amber-300/90">
                      {formatFCFA(it.qty * Number(it.unit_price))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-amber-300">{formatFCFA(Number(o.total) || 0)}</p>
                <button
                  type="button"
                  className="btn-primary text-sm min-h-[40px] px-4"
                  onClick={() => void advanceOrder(o)}
                >
                  {o.status === 'pending' && (
                    <>
                      <Clock size={14} className="inline mr-1" /> Préparer
                    </>
                  )}
                  {o.status === 'preparing' && (
                    <>
                      <CheckCircle2 size={14} className="inline mr-1" /> Prête
                    </>
                  )}
                  {o.status === 'ready' && (
                    <>
                      <Wallet size={14} className="inline mr-1" /> Encaisser / clôturer
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {closeFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-950 p-5 space-y-3">
            <h2 className="font-bold text-lg text-stone-100">Clôture table {closeFor.table_number || ''}</h2>
            <p className="text-sm text-stone-400">
              Paiement + décrément stock + enregistrement vente journée
            </p>
            <p className="text-2xl font-bold text-amber-300">
              {formatFCFA(Number(closeFor.total) || 0)}
            </p>
            <div className="flex gap-2">
              {(
                [
                  ['cash', 'Espèces'],
                  ['mobile', 'Mobile'],
                  ['mixed', 'Mixte'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPay(id)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                    pay === id ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setCloseFor(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary flex-1 min-h-[44px] flex items-center justify-center gap-2"
                disabled={busy}
                onClick={() => void confirmClose()}
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Wallet size={16} />}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
