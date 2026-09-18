import { useCallback, useEffect, useState } from 'react';
import {
  Receipt, Plus, Trash2, ShoppingBag, CheckCircle2, Clock, UtensilsCrossed, X, UserCog,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, RestaurantTable, Order } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/lib/types';
import { formatFCFA, formatTime } from '@/lib/format';
import { Modal, EmptyState, Badge } from '@/components/ui';
import {
  loadServerCandidates,
  assignServerToOrder,
  type ServerCandidate,
} from '@/lib/serverDispatch';

interface CartItem { product: Product; qty: number }

type OrderRow = Order & {
  customer_name?: string | null;
  server_id?: string | null;
  server_name?: string | null;
  source?: string | null;
};

export default function Orders() {
  const { member, effectiveRole } = useAuth();
  const estId = member?.establishment_id || null;
  const canAssign = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || ''),
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState('');
  const [notes, setNotes] = useState('');
  const [servers, setServers] = useState<ServerCandidate[]>([]);
  const [assignOrderId, setAssignOrderId] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    const [prodRes, tabRes, ordRes] = await Promise.all([
      supabase.from('products').select('*').eq('establishment_id', estId).order('name'),
      supabase.from('restaurant_tables').select('*').eq('establishment_id', estId).order('number'),
      supabase
        .from('orders')
        .select('*')
        .eq('establishment_id', estId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false }),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setTables((tabRes.data ?? []) as RestaurantTable[]);
    setOrders((ordRes.data ?? []) as OrderRow[]);
    if (canAssign) {
      const c = await loadServerCandidates(estId);
      setServers(c);
    }
    setLoading(false);
  }, [estId, canAssign]);

  useEffect(() => {
    void load();
  }, [load]);

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);

  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id);
      if (ex) return prev.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  }

  async function createOrder() {
    if (!estId || cart.length === 0) return;
    const total = cartTotal;
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        establishment_id: estId,
        table_id: tableId || null,
        status: 'pending',
        order_type: orderType,
        total,
        notes: notes || null,
        source: 'staff',
      })
      .select('id')
      .maybeSingle();
    if (error || !order?.id) {
      alert(error?.message || 'Création impossible');
      return;
    }
    for (const i of cart) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        qty: i.qty,
        unit_price: i.product.price,
        status: 'pending',
      });
    }
    setCart([]);
    setNotes('');
    setTableId('');
    setModalOpen(false);
    void load();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id);
    void load();
  }

  async function assignServer(order: OrderRow, server: ServerCandidate) {
    setAssignBusy(true);
    await assignServerToOrder({
      orderId: order.id,
      serverId: server.user_id,
      serverName: server.full_name,
      tableId: (order as { table_id?: string }).table_id || null,
    });
    setAssignBusy(false);
    setAssignOrderId(null);
    void load();
  }

  function clientLabel(o: OrderRow) {
    if (o.customer_name) return o.customer_name;
    const n = String(o.notes || '');
    const m = n.match(/Client:\s*([^·]+)/i);
    return m ? m[1].trim() : null;
  }

  if (loading) {
    return <div className="p-8 text-stone-400 text-center">Chargement…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
          <Receipt className="text-amber-400" /> Commandes
        </h1>
        <button type="button" className="btn-primary flex items-center gap-1" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Nouvelle
        </button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} />}
          title="Aucune commande en cours"
          message="Les commandes QR et caisse apparaissent ici."
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const client = clientLabel(o);
            return (
              <li
                key={o.id}
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stone-100">
                      {o.table_number != null ? `Table ${o.table_number}` : ORDER_TYPE_LABELS[o.order_type] || o.order_type}
                      {client ? (
                        <span className="text-amber-300"> · {client}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatTime(o.created_at)} · {formatFCFA(o.total)}
                      {o.source === 'qr_table' ? ' · QR' : ''}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Serveur :{' '}
                      <strong className="text-emerald-400">
                        {o.server_name || 'Non attribué'}
                      </strong>
                    </p>
                  </div>
                  <Badge>{ORDER_STATUS_LABELS[o.status] || o.status}</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {o.status === 'pending' && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => void updateStatus(o.id, 'preparing')}
                    >
                      <Clock size={12} className="inline mr-1" /> Préparer
                    </button>
                  )}
                  {o.status === 'preparing' && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => void updateStatus(o.id, 'ready')}
                    >
                      <UtensilsCrossed size={12} className="inline mr-1" /> Prêt
                    </button>
                  )}
                  {o.status === 'ready' && (
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => void updateStatus(o.id, 'served')}
                    >
                      <CheckCircle2 size={12} className="inline mr-1" /> Servi
                    </button>
                  )}
                  {canAssign && (
                    <button
                      type="button"
                      className="btn-secondary text-xs flex items-center gap-1"
                      onClick={() =>
                        setAssignOrderId(assignOrderId === o.id ? null : o.id)
                      }
                    >
                      <UserCog size={12} />
                      {o.server_id ? 'Changer serveuse' : 'Attribuer serveuse'}
                    </button>
                  )}
                </div>

                {canAssign && assignOrderId === o.id && (
                  <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-3 space-y-2">
                    <p className="text-xs text-stone-400">
                      Choisir une personne de l&apos;équipe (membres actifs)
                    </p>
                    {servers.length === 0 ? (
                      <p className="text-xs text-amber-300">
                        Aucun membre actif. Ajoutez des employés dans Équipe / Mes employés.
                      </p>
                    ) : (
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {servers.map((s) => (
                          <li key={s.user_id}>
                            <button
                              type="button"
                              disabled={assignBusy}
                              className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-stone-800 text-stone-200"
                              onClick={() => void assignServer(o, s)}
                            >
                              <span className="font-medium">{s.full_name}</span>
                              <span className="text-[10px] text-stone-500 ml-2">
                                {s.on_duty ? 'en service' : 'hors service'} ·{' '}
                                {s.open_orders} cmd
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle commande">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <label className="block text-xs text-stone-400">
            Type
            <select
              className="input-field mt-1"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as typeof orderType)}
            >
              <option value="dine_in">Sur place</option>
              <option value="takeaway">À emporter</option>
              <option value="delivery">Livraison</option>
            </select>
          </label>
          {orderType === 'dine_in' && (
            <label className="block text-xs text-stone-400">
              Table
              <select
                className="input-field mt-1"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
              >
                <option value="">—</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    Table {tb.number}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="text-left rounded-xl border border-stone-700 p-2 text-sm hover:border-amber-500"
                onClick={() => addToCart(p)}
              >
                {p.name}
                <span className="block text-amber-400 text-xs">{formatFCFA(p.price)}</span>
              </button>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="space-y-1 border-t border-stone-800 pt-2">
              {cart.map((i) => (
                <div key={i.product.id} className="flex justify-between text-sm items-center">
                  <span>
                    {i.product.name} × {i.qty}
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => updateQty(i.product.id, -1)}>
                      <Trash2 size={14} />
                    </button>
                    {formatFCFA(i.product.price * i.qty)}
                  </span>
                </div>
              ))}
              <p className="font-bold text-amber-300">Total {formatFCFA(cartTotal)}</p>
              <button type="button" className="btn-primary w-full" onClick={() => void createOrder()}>
                Créer la commande
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
