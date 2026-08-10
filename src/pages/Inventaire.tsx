import { getBusinessUI, normalizeBusinessType } from '@/lib/businessTypes';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Plus, Pencil, Trash2, Search, AlertTriangle,
  Sparkles, Download, Calculator, Camera, Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { Modal, EmptyState, Badge } from '@/components/ui';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';

const CASIER = 24;

const SEED_PRODUCTS = [
  { name: 'BOCK 66', category: 'Alcool', unit: 'Bouteille 65cl', stock: 0, min_stock: 12, cost: 450, price: 600 },
  { name: 'Castel / bières locales', category: 'Alcool', unit: 'Bouteille 50cl', stock: 26, min_stock: 12, cost: 400, price: 550 },
  { name: 'Racine fort / bières locales', category: 'Alcool', unit: 'Bouteille 50cl', stock: 0, min_stock: 12, cost: 400, price: 550 },
  { name: 'Racine / bières locales', category: 'Alcool', unit: 'Bouteille 50cl', stock: 26, min_stock: 12, cost: 400, price: 550 },
  { name: 'Dopel / bières locales', category: 'Alcool', unit: 'Bouteille 50cl', stock: 20, min_stock: 12, cost: 400, price: 550 },
  { name: 'Despe', category: 'Alcool', unit: 'Bouteille 33cl', stock: 0, min_stock: 6, cost: 700, price: 1000 },
  { name: 'Beauford 50cl', category: 'Alcool', unit: 'Bouteille 50cl', stock: 0, min_stock: 12, cost: 450, price: 650 },
  { name: 'Beauford 33cl', category: 'Alcool', unit: 'Bouteille 33cl', stock: 0, min_stock: 6, cost: 500, price: 700 },
  { name: 'Chamberi', category: 'Alcool', unit: 'Bouteille 75cl', stock: 0, min_stock: 2, cost: 2500, price: 4000 },
  { name: 'RLS', category: 'Alcool', unit: 'Bouteille 75cl', stock: 0, min_stock: 2, cost: 2500, price: 4000 },
  { name: 'Codis bières bleu', category: 'Alcool', unit: 'Canette 33cl', stock: 0, min_stock: 12, cost: 350, price: 500 },
  { name: 'Codis bières blanc', category: 'Alcool', unit: 'Canette 33cl', stock: 0, min_stock: 12, cost: 350, price: 500 },
  { name: 'Vody vodka mix 18%', category: 'Alcool', unit: 'Canette 33cl', stock: 16, min_stock: 12, cost: 400, price: 600 },
  { name: 'Tropial', category: 'Alcool', unit: 'Canette 33cl', stock: 16, min_stock: 12, cost: 350, price: 500 },
  { name: 'OKALAMAR', category: 'Alcool', unit: 'Canette 33cl', stock: 0, min_stock: 12, cost: 350, price: 500 },
  { name: 'Everess', category: 'Alcool', unit: 'Canette 33cl', stock: 3, min_stock: 12, cost: 350, price: 500 },
  { name: 'Rhino', category: 'Soda', unit: 'Bouteille 33cl', stock: 6, min_stock: 12, cost: 250, price: 400 },
  { name: 'Codis énergie', category: 'Soda', unit: 'Canette 33cl', stock: 0, min_stock: 6, cost: 300, price: 500 },
  { name: 'Fanta', category: 'Soda', unit: 'Bouteille 33cl', stock: 0, min_stock: 12, cost: 250, price: 400 },
  { name: 'Orangina', category: 'Soda', unit: 'Bouteille 33cl', stock: 1, min_stock: 6, cost: 300, price: 450 },
  { name: 'Coca', category: 'Soda', unit: 'Bouteille 33cl', stock: 1, min_stock: 12, cost: 250, price: 400 },
  { name: 'WordCola', category: 'Soda', unit: 'Bouteille 33cl', stock: 0, min_stock: 12, cost: 250, price: 400 },
  { name: 'Sprite', category: 'Soda', unit: 'Bouteille 33cl', stock: 1, min_stock: 12, cost: 250, price: 400 },
  { name: 'Youki Pomme', category: 'Soda', unit: 'Bouteille', stock: 4, min_stock: 6, cost: 200, price: 350 },
  { name: 'Youki Moka Café', category: 'Soda', unit: 'Bouteille', stock: 2, min_stock: 6, cost: 200, price: 350 },
];

function aiStatus(stock: number, min: number): { label: string; color: 'error' | 'warning' | 'success' | 'primary' } {
  if (stock <= 0) return { label: 'RUPTURE', color: 'error' };
  if (stock <= min) return { label: 'À COMMANDER', color: 'warning' };
  if (stock <= min * 1.5) return { label: 'SURVEILLER', color: 'primary' };
  return { label: 'OK', color: 'success' };
}

export default function Inventaire() {
  const navigate = useNavigate();
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const ui = getBusinessUI(activeEstablishment?.type);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'Alcool', price: '', cost: '', stock: '', min_stock: '12', unit: 'Bouteille 50cl',
  });

  async function loadProducts() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const cacheKey = `products:${member.establishment_id}`;
    const { data } = await fetchWithCache<Product[]>(cacheKey, async () => {
      const res = await supabase
        .from('products')
        .select('*')
        .eq('establishment_id', member.establishment_id)
        .order('category')
        .order('name');
      return (res.data ?? []) as Product[];
    });
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'Autre'));
    return ['Tous', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
      const matchC = filterCat === 'Tous' || p.category === filterCat;
      return matchQ && matchC;
    });
  }, [products, search, filterCat]);

  const totals = useMemo(() => {
    let units = 0;
    let value = 0;
    let rupture = 0;
    let commander = 0;
    let ok = 0;
    for (const p of products) {
      units += Number(p.stock) || 0;
      value += (Number(p.stock) || 0) * (Number(p.cost) || 0);
      const s = aiStatus(Number(p.stock) || 0, Number(p.min_stock) || 0);
      if (s.label === 'RUPTURE') rupture++;
      else if (s.label === 'À COMMANDER') commander++;
      else if (s.label === 'OK') ok++;
    }
    return { units, value, casiers: Math.floor(units / CASIER), rupture, commander, ok, count: products.length };
  }, [products]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', category: 'Alcool', price: '', cost: '', stock: '', min_stock: '12', unit: 'Bouteille 50cl' });
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category || 'Alcool',
      price: String(p.price ?? ''),
      cost: String(p.cost ?? ''),
      stock: String(p.stock ?? ''),
      min_stock: String(p.min_stock ?? 12),
      unit: p.unit || 'unité',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!member?.establishment_id || !form.name.trim()) return;
    const payload = {
      establishment_id: member.establishment_id,
      name: form.name.trim(),
      category: form.category || 'Autre',
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit: form.unit || 'unité',
    };
    if (isOnline()) {
      if (editing) {
        await supabase.from('products').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('products').insert(payload);
      }
      await loadProducts();
    } else {
      if (editing) {
        await queueAdd('products', 'update', payload, { id: editing.id });
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)));
      } else {
        const tempId = `offline-${Date.now()}`;
        await queueAdd('products', 'insert', payload);
        setProducts((prev) => [
          ...prev,
          { id: tempId, created_at: new Date().toISOString(), ...payload } as Product,
        ]);
      }
    }
    setModalOpen(false);
  }

  async function remove(p: Product) {
    if (!confirm(`Supprimer « ${p.name} » ?`)) return;
    if (isOnline()) {
      await supabase.from('products').delete().eq('id', p.id);
      await loadProducts();
    } else {
      await queueAdd('products', 'delete', {}, { id: p.id });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    }
  }


  async function sendCatalogToTeam() {
    if (!member?.establishment_id || !member.user_id) return;
    const n = products.length;
    if (!confirm(`Envoyer / partager le catalogue boissons (${n} produits) à toute l'équipe de cet établissement ?`)) return;
    const { error } = await supabase.from('catalog_events').insert({
      establishment_id: member.establishment_id,
      actor_id: member.user_id,
      event_type: 'send',
      message: `Catalogue partagé (${n} produits)`,
      payload: { product_count: n, product_names: products.slice(0, 50).map((p) => p.name) },
    });
    if (error) {
      alert('Erreur envoi catalogue: ' + error.message);
      return;
    }
    // Notifications aux autres membres de l'établissement
    const { data: team } = await supabase
      .from('members')
      .select('user_id')
      .eq('establishment_id', member.establishment_id)
      .eq('status', 'active')
      .neq('user_id', member.user_id);
    if (team?.length) {
      await supabase.from('notifications').insert(
        team.map((t) => ({
          user_id: t.user_id,
          title: 'Catalogue boissons mis à jour',
          body: `${member.full_name || 'Un collègue'} a partagé le catalogue (${n} produits). Voir Inventaire.`,
          type: 'catalog',
          link: '/inventory',
          read: false,
        }))
      );
    }
    alert('Catalogue envoyé à l\'équipe.');
  }

  async function resetCatalogStock() {
    if (!member?.establishment_id) return;
    const role = effectiveRole || member.role;
    if (!['super_admin', 'admin', 'owner', 'manager'].includes(role)) {
      alert('Seul le propriétaire / gérant peut remettre le stock à zéro.');
      return;
    }
    if (!confirm('REMETTRE TOUS LES STOCKS À ZÉRO pour cet établissement ? Action irréversible.')) return;
    const { data, error } = await supabase.rpc('reset_establishment_stock', {
      p_est: member.establishment_id,
    });
    if (error) {
      alert('Erreur reset: ' + error.message);
      return;
    }
    await loadProducts();
    alert(`Stock remis à zéro (${(data as any)?.products_updated ?? '?'} produits).`);
  }

  async function seedCatalog() {
    if (!member?.establishment_id) return;
    if (!confirm('Importer le catalogue maquis (bières, sodas, Vody…) ? Les produits déjà présents (même nom) ne seront pas dupliqués.')) return;
    setSeeding(true);
    const existing = new Set(products.map((p) => p.name.toLowerCase()));
    const toInsert = SEED_PRODUCTS.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => ({
      ...s,
      establishment_id: member.establishment_id,
    }));
    if (toInsert.length === 0) {
      alert('Tous les produits du catalogue sont déjà présents.');
      setSeeding(false);
      return;
    }
    if (isOnline()) {
      const { error } = await supabase.from('products').insert(toInsert);
      if (error) alert('Erreur: ' + error.message);
      else await loadProducts();
    } else {
      for (const row of toInsert) await queueAdd('products', 'insert', row);
      alert('Import mis en file hors-ligne. Reconnectez-vous pour synchroniser.');
    }
    setSeeding(false);
  }

  async function quickStock(p: Product, delta: number) {
    const next = Math.max(0, (Number(p.stock) || 0) + delta);
    if (isOnline()) {
      await supabase.from('products').update({ stock: next }).eq('id', p.id);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
      if (member?.establishment_id) {
        await cacheSet(`products:${member.establishment_id}`, products.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
      }
    } else {
      await queueAdd('products', 'update', { stock: next }, { id: p.id });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
    }
  }


  function printInventory(mode: 'stock' | 'blank' = 'blank') {
    const estName = member?.establishment_id ? 'Établissement' : 'Activité';
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const rows = filtered.map((p, i) => {
      const stock = Number(p.stock) || 0;
      const casiers = String(Math.floor(stock / CASIER));
      if (mode === 'blank') {
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(p.category || '')}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.unit || '')}</td>
          <td class="num">${stock}</td>
          <td class="blank">&nbsp;</td>
          <td class="blank">&nbsp;</td>
          <td class="blank">&nbsp;</td>
          <td class="blank">&nbsp;</td>
        </tr>`;
      }
      const val = stock * (Number(p.cost) || 0);
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.category || '')}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.unit || '')}</td>
        <td class="num">${stock}</td>
        <td class="num">${casiers}</td>
        <td class="num">${Number(p.cost || 0).toLocaleString('fr-FR')}</td>
        <td class="num">${Number(p.price || 0).toLocaleString('fr-FR')}</td>
        <td class="num">${val.toLocaleString('fr-FR')}</td>
      </tr>`;
    }).join('');

    const headersBlank = `
      <th>N°</th><th>Catégorie</th><th>Produit</th><th>Format</th>
      <th>Stock système</th><th>Comptage manuscrit</th><th>Écart</th>
      <th>Prix achat</th><th>Observation</th>`;
    const headersStock = `
      <th>N°</th><th>Catégorie</th><th>Produit</th><th>Format</th>
      <th>Qté</th><th>Casiers</th><th>P. achat</th><th>P. vente</th><th>Valeur</th>`;

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Inventaire — ${dateStr}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #444; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 5px 6px; text-align: left; }
  th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; }
  td.num { text-align: right; }
  td.blank { min-width: 70px; height: 22px; }
  .foot { margin-top: 14px; font-size: 10px; color: #555; }
  .sign { margin-top: 20px; display: flex; justify-content: space-between; }
  .sign div { width: 30%; border-top: 1px solid #333; padding-top: 4px; text-align: center; }
  @media print { .no-print { display: none; } }
</style></head><body>
  <h1>{ui.inventoryTitle} physique — Stock Manager AI</h1>
  <div class="meta">${dateStr} · Mode : ${mode === 'blank' ? 'Feuille manuscrite (comptage)' : 'État du stock'}</div>
  <table>
    <thead><tr>${mode === 'blank' ? headersBlank : headersStock}</tr></thead>
    <tbody>${rows || '<tr><td colspan="9">Aucun article</td></tr>'}</tbody>
  </table>
  <div class="foot">
    ${mode === 'blank'
      ? 'Remplissez la colonne « Comptage manuscrit », calculez l’écart, puis scannez la feuille dans l’app (Inventaire → Scanner photo IA).'
      : 'Document généré depuis Stock Manager AI — valeur au coût d’achat.'}
  </div>
  <div class="sign">
    <div>Gérant</div>
    <div>Propriétaire</div>
    <div>Date / cachet</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('Autorisez les pop-ups pour imprimer.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement inventaire…</div>;
  }

  if (!member?.establishment_id) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Aucun établissement"
        message="Vous n'êtes rattaché à aucun établissement."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Package className="text-amber-400" size={26} /> {ui.inventoryTitle}
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {ui.inventorySubtitle} · calculs auto · alertes IA
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(normalizeBusinessType(activeEstablishment?.type) === 'maquis' ||
            normalizeBusinessType(activeEstablishment?.type) === 'bar') && (
          <button
            onClick={seedCatalog}
            disabled={seeding}
            className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 flex items-center gap-1.5"
          >
            <Download size={16} /> {seeding ? 'Import…' : 'Catalogue boissons'}
          </button>
          )}
          <button
            type="button"
            onClick={() => printInventory('blank')}
            className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 flex items-center gap-1.5"
            title="Feuille à remplir à la main"
          >
            <Printer size={16} /> Imprimer (manuscrit)
          </button>
          <button
            type="button"
            onClick={() => printInventory('stock')}
            className="px-3 py-2 rounded-xl border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 flex items-center gap-1.5"
            title="État actuel du stock"
          >
            <Printer size={16} /> Imprimer stock
          </button>
          <button type="button" onClick={() => navigate('/inventory/scan')} className="btn-secondary flex items-center gap-2">
            <Camera size={18} /> Scanner photo (IA)
          </button>
          <button type="button" onClick={sendCatalogToTeam} className="px-3 py-2 rounded-xl border border-amber-600/50 text-amber-200 text-sm hover:bg-amber-500/10">
            Envoyer catalogue
          </button>
          {['super_admin','admin','owner','manager'].includes((effectiveRole || member?.role || '') as string) && (
            <button type="button" onClick={resetCatalogStock} className="px-3 py-2 rounded-xl border border-error-500/40 text-error-300 text-sm hover:bg-error-500/10">
              Reset stock → 0
            </button>
          )}
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Ajouter
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Valeur stock (achat)</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{totals.value.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span></p>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Unités / Casiers</p>
          <p className="text-xl font-bold text-stone-100 mt-1">
            {totals.units} <span className="text-sm font-normal text-stone-400">· {Math.floor(Number(totals.casiers))} casiers</span>
          </p>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide flex items-center gap-1"><Sparkles size={12} /> Alertes IA</p>
          <p className="text-xl font-bold mt-1">
            <span className="text-red-400">{totals.rupture}</span>
            <span className="text-stone-500 text-sm font-normal"> rupture · </span>
            <span className="text-amber-400">{totals.commander}</span>
            <span className="text-stone-500 text-sm font-normal"> cmd</span>
          </p>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Références</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{totals.count} <span className="text-sm font-normal text-stone-400">produits</span></p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            placeholder="Rechercher produit ou catégorie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-2 rounded-xl text-sm border transition ${
                filterCat === c
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-stone-700 text-stone-400 hover:bg-stone-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="Aucun article"
          message="Cliquez sur « Catalogue maquis » pour importer les boissons, ou « Ajouter »."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-stone-900/50">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-stone-800/80 text-stone-300 text-left">
                <th className="px-3 py-3 font-medium">Catégorie</th>
                <th className="px-3 py-3 font-medium">Produit / Marque</th>
                <th className="px-3 py-3 font-medium">Format</th>
                <th className="px-3 py-3 font-medium text-right">Qté</th>
                <th className="px-3 py-3 font-medium text-right">
                  <span className="inline-flex items-center gap-1"><Calculator size={12} /> Casiers</span>
                </th>
                <th className="px-3 py-3 font-medium text-right">Achat</th>
                <th className="px-3 py-3 font-medium text-right">Vente</th>
                <th className="px-3 py-3 font-medium text-right">Valeur stock</th>
                <th className="px-3 py-3 font-medium text-center">Statut IA</th>
                <th className="px-3 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = Number(p.stock) || 0;
                const min = Number(p.min_stock) || 0;
                const cost = Number(p.cost) || 0;
                const price = Number(p.price) || 0;
                const casiers = Math.floor(stock / CASIER);
                const valeur = stock * cost;
                const status = aiStatus(stock, min);
                const low = stock <= min;

                return (
                  <tr key={p.id} className="border-t border-stone-800 hover:bg-stone-800/40">
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.category === 'Alcool' ? 'bg-amber-500/15 text-amber-300' : 'bg-sky-500/15 text-sky-300'
                      }`}>
                        {p.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-stone-100">
                      <span className="inline-flex items-center gap-1.5">
                        {low && <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                        {p.name}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-stone-400">{p.unit}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => quickStock(p, -1)}
                          className="w-7 h-7 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700"
                        >
                          −
                        </button>
                        <span className={`min-w-[2.5rem] text-center font-semibold ${low ? 'text-amber-300' : 'text-stone-100'}`}>
                          {stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => quickStock(p, 1)}
                          className="w-7 h-7 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-stone-400">{casiers}</td>
                    <td className="px-3 py-2.5 text-right text-stone-400">{cost.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-right text-stone-300">{price.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-amber-300/90">{valeur.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge color={status.color}>{status.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-stone-200">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-400 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-700 bg-stone-800/60 font-semibold text-stone-100">
                <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                <td className="px-3 py-3 text-right">{totals.units}</td>
                <td className="px-3 py-3 text-right">{Math.floor(Number(totals.casiers))}</td>
                <td className="px-3 py-3" />
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right text-amber-400">{totals.value.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-3" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-stone-500">
        Casiers = Qté ÷ 24 · Valeur stock = Qté × prix d&apos;achat · Statut IA : RUPTURE / À COMMANDER / SURVEILLER / OK selon stock min.
      </p>

      {/* Modal add/edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le produit' : 'Nouveau produit'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom / Marque</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="ex: Castel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Catégorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">
                {ui.categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Format / Unité</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field" placeholder="Bouteille 50cl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prix d&apos;achat (FCFA)</label>
              <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Prix de vente (FCFA)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantité (stock)</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Stock minimum</label>
              <input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="input-field" />
            </div>
          </div>
          {(Number(form.stock) > 0 || Number(form.cost) > 0) && (
            <div className="rounded-xl bg-stone-800/80 px-3 py-2 text-sm text-stone-300 flex justify-between">
              <span>Aperçu auto</span>
              <span>
                {Math.floor(Number(form.stock) / CASIER)} casiers ·{' '}
                {((Number(form.stock) || 0) * (Number(form.cost) || 0)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter au stock'}</button>
        </div>
      </Modal>
    </div>
  );
}
