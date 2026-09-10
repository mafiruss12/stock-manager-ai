import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Minus, Plus, Send, CheckCircle2, Beer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatFCFA } from '@/lib/format';
import ProductThumb from '@/components/ProductThumb';

type Est = {
  id: string;
  name: string;
  public_menu?: boolean;
  phone?: string | null;
};

type Prod = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  stock: number;
  image_url?: string | null;
};

export default function PublicTableOrder() {
  const { estId } = useParams<{ estId: string }>();
  const [params] = useSearchParams();
  const tableNum = (params.get('table') || params.get('t') || '').trim();

  const [est, setEst] = useState<Est | null>(null);
  const [products, setProducts] = useState<Prod[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cat, setCat] = useState('Tous');

  useEffect(() => {
    document.title = tableNum
      ? `Commander · Table ${tableNum}`
      : 'Commander · Stock Manager';
  }, [tableNum]);

  useEffect(() => {
    if (!estId) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: e } = await supabase
        .from('establishments')
        .select('id, name, public_menu, phone')
        .eq('id', estId)
        .maybeSingle();
      if (cancelled) return;
      if (!e) {
        setError('Établissement introuvable.');
        setLoading(false);
        return;
      }
      setEst(e as Est);

      const { data: prods } = await supabase
        .from('products')
        .select('id, name, category, price, stock, image_url')
        .eq('establishment_id', estId)
        .order('name');
      setProducts(((prods as Prod[]) || []).filter((p) => Number(p.price) > 0));

      if (tableNum) {
        const { data: tabs } = await supabase
          .from('restaurant_tables')
          .select('id, number')
          .eq('establishment_id', estId);
        const match = (tabs || []).find(
          (t: any) => String(t.number).toLowerCase() === tableNum.toLowerCase(),
        );
        if (match) setTableId(match.id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [estId, tableNum]);

  const categories = useMemo(() => {
    const s = new Set(products.map((p) => p.category || 'Autres'));
    return ['Tous', ...Array.from(s).sort()];
  }, [products]);

  const visible = useMemo(() => {
    if (cat === 'Tous') return products;
    return products.filter((p) => (p.category || 'Autres') === cat);
  }, [products, cat]);

  const lines = useMemo(() => {
    return products
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({
        product: p,
        qty: cart[p.id],
        total: cart[p.id] * Math.round(Number(p.price) || 0),
      }));
  }, [products, cart]);

  const total = lines.reduce((s, l) => s + l.total, 0);

  function bump(id: string, d: number) {
    setCart((c) => {
      const n = Math.max(0, (c[id] || 0) + d);
      const next = { ...c };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  async function submit() {
    if (!estId || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          establishment_id: estId,
          table_id: tableId,
          table_number: tableNum || null,
          status: 'pending',
          order_type: 'dine_in',
          total,
          notes: note || (tableNum ? `Table ${tableNum} (QR client)` : 'Commande QR'),
          source: 'qr_table',
        })
        .select('id')
        .maybeSingle();

      if (oErr || !order?.id) {
        // fallback sans colonnes optionnelles
        const { data: o2, error: e2 } = await supabase
          .from('orders')
          .insert({
            establishment_id: estId,
            table_id: tableId,
            table_number: tableNum || null,
            status: 'pending',
            order_type: 'dine_in',
            total,
            notes: note || `Table ${tableNum || '?'} QR`,
          })
          .select('id')
          .maybeSingle();
        if (e2 || !o2?.id) {
          throw new Error(
            e2?.message ||
              oErr?.message ||
              'Commande refusée. Activez les commandes QR (politique Supabase) ou réessayez.',
          );
        }
        for (const l of lines) {
          await supabase.from('order_items').insert({
            order_id: o2.id,
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Math.round(Number(l.product.price) || 0),
            status: 'pending',
          });
        }
      } else {
        for (const l of lines) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            product_id: l.product.id,
            product_name: l.product.name,
            qty: l.qty,
            unit_price: Math.round(Number(l.product.price) || 0),
            status: 'pending',
          });
        }
      }

      if (tableId) {
        await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId);
      }

      setDone(true);
      setCart({});
      setNote('');
    } catch (e: any) {
      setError(e?.message || 'Envoi impossible');
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] text-stone-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error && !est) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] text-stone-300 p-6 text-center">
        {error}
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0a09] text-stone-100 p-6 text-center gap-3">
        <CheckCircle2 className="text-emerald-400" size={48} />
        <h1 className="text-xl font-bold">Commande envoyée</h1>
        <p className="text-stone-400 text-sm">
          {tableNum ? `Table ${tableNum}` : 'Commande'} · le bar / service s’en occupe.
        </p>
        <button
          type="button"
          className="mt-4 px-5 py-3 rounded-xl bg-amber-500 text-stone-950 font-bold"
          onClick={() => setDone(false)}
        >
          Commander encore
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-100 pb-36">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-[#0c0a09]/90 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Beer className="text-amber-400" size={22} />
          <div className="min-w-0">
            <h1 className="font-bold truncate">{est?.name || 'Menu'}</h1>
            <p className="text-xs text-stone-400">
              {tableNum ? `Table ${tableNum} · commande QR` : 'Commande QR'}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 pt-3 space-y-3">
        {!tableNum && (
          <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            Astuce : le QR de table contient le numéro (ex. table=5).
          </p>
        )}
        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                cat === c ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {visible.map((p) => {
            const q = cart[p.id] || 0;
            const soldOut = Number(p.stock) <= 0;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-2 ${
                  q > 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-stone-800 bg-stone-900/60'
                } ${soldOut ? 'opacity-50' : ''}`}
              >
                <div className="flex gap-2">
                  <ProductThumb product={p as any} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-amber-300">{formatFCFA(Number(p.price) || 0)}</p>
                    {soldOut && <p className="text-[10px] text-red-300">Épuisé</p>}
                  </div>
                </div>
                {!soldOut && (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-stone-800"
                      onClick={() => bump(p.id, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-amber-300">{q}</span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-stone-800"
                      onClick={() => bump(p.id, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="block text-xs text-stone-400">
          Note (optionnel)
          <input
            className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100"
            placeholder="Sans glaçon, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {lines.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-stone-800 bg-[#0c0a09]/95 backdrop-blur p-3">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">{lines.reduce((s, l) => s + l.qty, 0)} article(s)</span>
              <span className="font-bold text-amber-300">{formatFCFA(total)}</span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full min-h-[48px] rounded-xl bg-amber-500 text-stone-950 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Envoyer la commande
            </button>
            <p className="text-[10px] text-center text-stone-500">
              Paiement au serveur · stock géré par l’établissement
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
