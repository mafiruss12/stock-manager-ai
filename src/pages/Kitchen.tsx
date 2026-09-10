import { useEffect, useRef, useState } from 'react';
import { UtensilsCrossed, CheckCircle2, Clock, ChefHat, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Order, OrderItem } from '@/lib/types';
import { ORDER_STATUS_LABELS } from '@/lib/types';
import { formatTime } from '@/lib/format';
import { EmptyState, Badge } from '@/components/ui';

interface OrderWithItems extends Order {
  items?: OrderItem[];
}

export default function Kitchen() {
  const { member } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPending = useRef(0);

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data: ordData } = await supabase
      .from('orders')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (!ordData) { setLoading(false); return; }

    const ids = (ordData as Order[]).map((o) => o.id);
    let itemsByOrder: Record<string, OrderItem[]> = {};
    if (ids.length) {
      const { data: allItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', ids);
      for (const it of (allItems as OrderItem[]) || []) {
        (itemsByOrder[it.order_id] ||= []).push(it);
      }
    }
    const ordersWithItems = (ordData as Order[]).map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));
    setOrders(ordersWithItems);
    const pend = ordersWithItems.filter((o) => o.status === 'pending').length;
    if (pend > prevPending.current && prevPending.current >= 0 && !loading) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.05;
        o.start(); o.stop(ctx.currentTime + 0.15);
      } catch { /* */ }
      try { document.title = `(${pend}) Cuisine / Bar`; } catch { /* */ }
    }
    prevPending.current = pend;
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
    /* eslint-disable-next-line */
  }, [member]);

  async function advanceOrder(o: OrderWithItems) {
    const next: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' };
    await supabase.from('orders').update({ status: next[o.status] }).eq('id', o.id);
    if (o.items) {
      for (const item of o.items) {
        await supabase.from('order_items').update({ status: next[o.status] === 'served' ? 'served' : next[o.status] }).eq('id', item.id);
      }
    }
    if (o.status === 'ready') {
      if (o.table_id) await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', o.table_id);
    }
    await load();
  }

  async function advanceItem(item: OrderItem) {
    const next: Record<string, string> = { pending: 'preparing', preparing: 'ready', ready: 'served' };
    await supabase.from('order_items').update({ status: next[item.status] }).eq('id', item.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<UtensilsCrossed size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const pending = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const ready = orders.filter((o) => o.status === 'ready').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <ChefHat className="text-primary-400" /> Cuisine / Bar
          </h1>
          <p className="text-stone-400 text-sm">Écran de production en temps réel</p>
        </div>
        <div className="flex gap-2">
          <Badge color="warning">{pending} en attente</Badge>
          <Badge color="primary">{preparing} en cours</Badge>
          <Badge color="success">{ready} prêts</Badge>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed size={48} />} title="Aucune commande" message="Les nouvelles commandes apparaîtront ici automatiquement." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className={`card border-2 ${
                o.status === 'pending' ? 'border-warning-500/50' :
                o.status === 'preparing' ? 'border-primary-500/50' :
                'border-success-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-stone-100 text-lg">{o.table_number ?? 'À emporter'}</p>
                  <p className="text-xs text-stone-500 flex items-center gap-1">
                    <Clock size={10} /> {formatTime(o.created_at)}
                  </p>
                </div>
                <Badge color={o.status === 'pending' ? 'warning' : o.status === 'preparing' ? 'primary' : 'success'}>
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>

              {o.notes && (
                <div className="bg-warning-500/10 rounded-lg p-2 mb-3 text-sm text-warning-300">
                  {o.notes}
                </div>
              )}

              <div className="space-y-1.5 mb-3">
                {(o.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-stone-800/50 rounded-lg p-2">
                    <span className="flex-1 text-sm text-stone-200">
                      <span className="font-bold text-primary-400">{item.qty}×</span> {item.product_name}
                    </span>
                    <button
                      onClick={() => advanceItem(item)}
                      className={`px-2 py-0.5 rounded text-xs transition-all ${
                        item.status === 'pending' ? 'bg-warning-500/20 text-warning-300 hover:bg-warning-500/30' :
                        item.status === 'preparing' ? 'bg-primary-500/20 text-primary-300 hover:bg-primary-500/30' :
                        'bg-success-500/20 text-success-300'
                      }`}
                    >
                      {item.status === 'pending' ? '→ Préparer' : item.status === 'preparing' ? '→ Prêt' : 'OK'}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => advanceOrder(o)}
                className={`w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  o.status === 'pending' ? 'btn-primary' : o.status === 'preparing' ? 'btn-secondary' : 'bg-success-600 hover:bg-success-700 text-white'
                }`}
              >
                {o.status === 'pending' ? 'Commencer la préparation' :
                 o.status === 'preparing' ? 'Marquer comme prêt' :
                 'Servir et clôturer'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
