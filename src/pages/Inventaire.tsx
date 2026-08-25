import { getBusinessUI, normalizeBusinessType } from '@/lib/businessTypes';
import { getSeedCatalog, catalogLabel, usesCasiers, casierSize } from '@/lib/catalogs';
import { logAudit, newClientOpId } from '@/lib/audit';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Pencil, Trash2, Search, AlertTriangle, Sparkles, Download, Upload, Calculator, Camera, Printer, Truck, MoreHorizontal, History, RefreshCw, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product } from '@/lib/types';
import { Modal, EmptyState, Badge } from '@/components/ui';
import ProductThumb from '@/components/ProductThumb';
import { cacheSet, fetchWithCache, isOnline, queueAdd } from '@/lib/offline';
import { speakFrench, playTone } from '@/lib/a11yVoice';

function aiStatus(stock: number, min: number): { label: string; color: 'error' | 'warning' | 'success' | 'primary' } {
  if (stock <= 0) return { label: 'RUPTURE', color: 'error' };
  if (stock <= min) return { label: 'À COMMANDER', color: 'warning' };
  if (stock <= min * 1.5) return { label: 'SURVEILLER', color: 'primary' };
  return { label: 'OK', color: 'success' };
}

export default function Inventaire() {
  const navigate = useNavigate();
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const bizType = normalizeBusinessType((activeEstablishment as any)?.type);
  const ui = getBusinessUI(bizType);
  const showCasiers = usesCasiers(bizType);
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const roleNow = String(effectiveRole || member?.role || '');
  /** Propriétaire / admin, ou membre explicitement autorisé (can_edit_stock) */
  const canEditStock =
    ['super_admin', 'admin', 'owner'].includes(roleNow) ||
    Boolean(member?.can_edit_stock);
  const isStaffOnly = ['employee', 'cashier', 'manager'].includes(roleNow) && !canEditStock;
  const CASIER = 24;
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [tab, setTab] = useState<'stock' | 'arrivage' | 'options'>('stock');
  useEffect(() => {
    if (!canEditStock && tab !== 'stock') setTab('stock');
  }, [canEditStock, tab]);

  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [liveNote, setLiveNote] = useState('');
  const [arrivageForm, setArrivageForm] = useState({ productId: '', qty: '', note: '' });

  const [form, setForm] = useState({
    name: '', category: ui.categories[0] || 'Autre', price: '', cost: '', stock: '', min_stock: '12', unit: ui.unitDefault || 'unité', image_url: '', units_per_package: '12', consigne_unit: '', empty_bottles: '0',
  });

  async function loadProducts() {
    if (!estId) {
      setLoading(false);
      return;
    }
    const cacheKey = `products:${estId}`;
    const { data } = await fetchWithCache<Product[]>(cacheKey, async () => {
      const res = await supabase
        .from('products')
        .select('*')
        .eq('establishment_id', estId)
        .order('name', { ascending: true });
      return (res.data ?? []) as Product[];
    });
    setProducts(
      [...(data ?? [])].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' })
      )
    );
    setLoading(false);
  }

  async function loadAudit() {
    if (!estId) return;
    const { data } = await supabase
      .from('operation_audit')
      .select('id, action, entity_label, actor_name, old_value, new_value, reason, created_at')
      .eq('establishment_id', estId)
      .order('created_at', { ascending: false })
      .limit(40);
    setAuditRows(data || []);
  }

  useEffect(() => {
    loadProducts();
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, estId]);

  // Temps réel : tout le monde voit le stock à jour
  useEffect(() => {
    if (!estId) return;
    const channel = supabase
      .channel(`products-live-${estId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `establishment_id=eq.${estId}` },
        () => {
          setLiveNote('Stock mis à jour (équipe)');
          loadProducts();
          loadAudit();
          setTimeout(() => setLiveNote(''), 2500);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'Autre'));
    return ['Tous', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        const q = search.toLowerCase();
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
        const matchC = filterCat === 'Tous' || p.category === filterCat;
        return matchQ && matchC;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' }));
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
    if (!canEditStock) return;
    setEditing(null);
    setForm({ name: '', category: ui.categories[0] || 'Autre', price: '', cost: '', stock: '', min_stock: '12', unit: ui.unitDefault || 'unité', image_url: '', units_per_package: '12', consigne_unit: '', empty_bottles: '0' });
    if (!canEditStock) { alert('Modification réservée au propriétaire / gérant.'); return; }
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
      image_url: (p as Product).image_url || '',
      units_per_package: String(p.units_per_package ?? 12),
      consigne_unit: String(p.consigne_unit ?? ''),
      empty_bottles: String(p.empty_bottles ?? 0),
      unit: p.unit || 'unité',
    });
    if (!canEditStock) { alert('Modification réservée au propriétaire / gérant.'); return; }
    setModalOpen(true);
  }

  async function save() {
    if (!canEditStock) { alert('Modification réservée au propriétaire / gérant.'); return; }
    if (!estId || !form.name.trim()) return;
    const isEdit = Boolean(editing);
    const msg = isEdit
      ? `Confirmer la modification de « ${form.name.trim()} » ?`
      : `Confirmer l'ajout de « ${form.name.trim()} » au stock ?`;
    if (!confirm(msg)) return;
    const payload = {
      establishment_id: estId,
      name: form.name.trim(),
      category: form.category || 'Autre',
      image_url: form.image_url.trim() || null,
      units_per_package: Number(form.units_per_package) || 12,
      consigne_unit: Number(form.consigne_unit) || 0,
      empty_bottles: Number(form.empty_bottles) || 0,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      unit: form.unit || 'unité',
    };
    const opId = newClientOpId();
    if (isOnline()) {
      if (editing) {
        const old = {
          name: editing.name,
          stock: editing.stock,
          min_stock: editing.min_stock,
          price: editing.price,
          cost: editing.cost,
          image_url: (editing as Product).image_url,
        };
        const { error: upErr } = await supabase.from('products').update(payload).eq('id', editing.id);
        if (upErr) {
          alert('Enregistrement image/produit impossible : ' + upErr.message);
          return;
        }
        // Mise à jour immédiate de la liste (image comprise)
        setProducts((prev) =>
          prev.map((p) => (p.id === editing.id ? { ...p, ...payload } as Product : p))
        );
        await logAudit({
          establishment_id: estId,
          actor_id: member?.user_id,
          actor_name: member?.full_name || member?.email,
          action: 'product.update',
          entity_type: 'product',
          entity_id: editing.id,
          entity_label: payload.name,
          old_value: old,
          new_value: payload,
          client_op_id: opId,
        });
      } else {
        const { data: ins, error: insErr } = await supabase.from('products').insert(payload).select('id').maybeSingle();
        if (insErr) {
          alert('Création impossible : ' + insErr.message);
          return;
        }
        await logAudit({
          establishment_id: estId,
          actor_id: member?.user_id,
          actor_name: member?.full_name || member?.email,
          action: 'product.create',
          entity_type: 'product',
          entity_id: ins?.id || null,
          entity_label: payload.name,
          new_value: payload,
          client_op_id: opId,
        });
      }
      await loadProducts();
    } else {
      if (editing) {
        await queueAdd('products', 'update', { ...payload, _client_op_id: opId }, { id: editing.id });
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...payload } : p)));
      } else {
        const tempId = `offline-${Date.now()}`;
        await queueAdd('products', 'insert', { ...payload, _client_op_id: opId });
        setProducts((prev) => [
          ...prev,
          { id: tempId, created_at: new Date().toISOString(), ...payload } as Product,
        ]);
      }
    }
    setModalOpen(false);
  }

  async function remove(p: Product) {
    if (!canEditStock) { alert('Suppression réservée au propriétaire / gérant.'); return; }
    if (!confirm(`Voulez-vous vraiment supprimer définitivement « ${p.name} » du stock ?`)) return;
    const opId = newClientOpId();
    if (isOnline()) {
      await supabase.from('products').delete().eq('id', p.id);
      await logAudit({
        establishment_id: estId,
        actor_id: member?.user_id,
        actor_name: member?.full_name || member?.email,
        action: 'product.delete',
        entity_type: 'product',
        entity_id: p.id,
        entity_label: p.name,
        old_value: { name: p.name, stock: p.stock, price: p.price },
        client_op_id: opId,
      });
      await loadProducts();
    } else {
      await queueAdd('products', 'delete', { _client_op_id: opId }, { id: p.id });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    }
  }


  async function sendCatalogToTeam() {
    if (!member?.establishment_id || !member.user_id) return;
    const n = products.length;
    if (!confirm(`Envoyer / partager le catalogue produits (${n} produits) a toute l equipe de cet etablissement ?`)) return;
    const { error } = await supabase.from('catalog_events').insert({
      establishment_id: estId,
      actor_id: member.user_id,
      event_type: 'send',
      message: `Catalogue produits partagé (${n} produits)`,
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
      .eq('establishment_id', estId)
      .eq('status', 'active')
      .neq('user_id', member.user_id);
    if (team?.length) {
      await supabase.from('notifications').insert(
        team.map((t) => ({
          user_id: t.user_id,
          title: 'Catalogue produits mis à jour',
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
    if (!estId) return;
    const role = effectiveRole || member.role;
    if (!['super_admin', 'admin', 'owner', 'manager'].includes(role)) {
      alert('Seul le propriétaire / gérant peut remettre le stock à zéro.');
      return;
    }
    if (!confirm('REMETTRE TOUS LES STOCKS À ZÉRO pour cet établissement ? Action irréversible.')) return;
    const { data, error } = await supabase.rpc('reset_establishment_stock', {
      p_est: estId,
    });
    if (error) {
      alert('Erreur reset: ' + error.message);
      return;
    }
    await loadProducts();
    alert(`Stock remis à zéro (${(data as any)?.products_updated ?? '?'} produits).`);
  }



  function buildCatalogPayload() {
    return {
      version: 1,
      type: 'stock-manager-catalog',
      business_type: bizType,
      establishment_id: estId,
      exported_at: new Date().toISOString(),
      products: products.map((p) => ({
        name: p.name,
        category: p.category || 'Autre',
        unit: p.unit || 'unité',
        price: Number(p.price) || 0,
        cost: Number(p.cost) || 0,
        min_stock: Number(p.min_stock) || 0,
        stock: Number(p.stock) || 0,
      })),
    };
  }

  function catalogJsonText(): string {
    return JSON.stringify(buildCatalogPayload(), null, 2);
  }

  function catalogSummaryText(): string {
    const lines = products.slice(0, 40).map(
      (p) => `• ${p.name} — stock ${p.stock} — vente ${p.price} F`
    );
    const more = products.length > 40 ? `\n… +${products.length - 40} autres` : '';
    return (
      `*Stock Manager AI — Catalogue*\n` +
      `${products.length} produit(s)\n\n` +
      lines.join('\n') +
      more +
      `\n\n_Pour importer dans l'app : Inventaire → Plus d'options → Coller le catalogue_`
    );
  }

  /** Ouvre le panneau Partager le stock */
  function openShareStock() {
    if (!products.length) {
      alert('Aucun produit dans le stock à partager.');
      return;
    }
    setShareModalOpen(true);
  }

  async function shareStockNative() {
    setShareBusy(true);
    try {
      const text = catalogJsonText();
      const summary = catalogSummaryText();
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Catalogue stock', text: text.length < 50000 ? text : summary });
          alert('Partage lancé.');
          return;
        } catch {
          /* annulé */
        }
      }
      await navigator.clipboard.writeText(text);
      alert('Catalogue copié. Collez-le dans WhatsApp ou Notes, puis sur l\'autre téléphone utilisez « Coller le catalogue ».');
    } catch (e) {
      alert('Erreur partage : ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setShareBusy(false);
    }
  }

  async function copyCatalog() {
    try {
      const text = catalogJsonText();
      await navigator.clipboard.writeText(text);
      alert('Catalogue copié (' + products.length + ' produits). Sur l\'autre appareil : Coller le catalogue.');
    } catch {
      // fallback textarea
      setImportText(catalogJsonText());
      setShareModalOpen(true);
      alert('Copie automatique bloquée. Le texte est affiché : sélectionnez-le et copiez.');
    }
  }

  function shareStockWhatsApp() {
    const summary = catalogSummaryText();
    // WhatsApp limite la taille : résumé + invitation
    const url = 'https://wa.me/?text=' + encodeURIComponent(summary);
    window.open(url, '_blank', 'noopener');
  }

  async function exportCatalogJson() {
    openShareStock();
    await shareStockNative();
  }

  async function exportCatalogCsv() {
    openShareStock();
    await copyCatalog();
  }

  /** Import fichier JSON ou CSV généré par l'app */
  async function importCatalogFromText(raw: string) {
    if (!canEditStock) {
      alert('Import réservé au propriétaire ou membre autorisé.');
      return;
    }
    if (!estId) {
      alert('Aucun établissement actif.');
      return;
    }
    const text = (raw || '').trim();
    if (!text) {
      alert('Collez d\'abord le contenu du catalogue (JSON).');
      return;
    }
    type Row = {
      name: string;
      category?: string;
      unit?: string;
      price?: number;
      cost?: number;
      min_stock?: number;
      stock?: number;
    };
    let rows: Row[] = [];
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : data.products || data.items || [];
      rows = list.map((x: any) => ({
        name: String(x.name || x.nom || '').trim(),
        category: String(x.category || x.categorie || 'Autre'),
        unit: String(x.unit || x.unite || 'unité'),
        price: Number(x.price ?? x.prix_vente ?? 0) || 0,
        cost: Number(x.cost ?? x.prix_achat ?? 0) || 0,
        min_stock: Number(x.min_stock ?? x.stock_min ?? 0) || 0,
        stock: Number(x.stock ?? 0) || 0,
      }));
    } catch {
      alert('Texte invalide. Collez un catalogue JSON exporté depuis Stock Manager.');
      return;
    }
    rows = rows.filter((r) => r.name);
    if (!rows.length) {
      alert('Aucun produit dans le catalogue collé.');
      return;
    }
    if (!confirm('Importer ' + rows.length + ' produit(s) ? Les noms déjà présents ne seront pas dupliqués.')) return;
    const existing = new Set(products.map((p) => p.name.toLowerCase().trim()));
    let added = 0;
    for (const r of rows) {
      if (existing.has(r.name.toLowerCase().trim())) continue;
      const payload = {
        establishment_id: estId,
        name: r.name,
        category: r.category || 'Autre',
        unit: r.unit || 'unité',
        price: r.price || 0,
        cost: r.cost || 0,
        min_stock: r.min_stock || 0,
        stock: r.stock || 0,
      };
      if (isOnline()) {
        const { error } = await supabase.from('products').insert(payload);
        if (!error) {
          added++;
          existing.add(r.name.toLowerCase().trim());
        }
      } else {
        await queueAdd('products', 'insert', { ...payload, _client_op_id: newClientOpId() });
        added++;
        existing.add(r.name.toLowerCase().trim());
      }
    }
    await loadProducts();
    setShareModalOpen(false);
    setImportText('');
    alert(added + ' produit(s) importé(s). ' + (rows.length - added) + ' ignoré(s).');
  }

  async function importCatalogFile(file: File) {

    if (!canEditStock) {
      alert('Import réservé au propriétaire ou membre autorisé.');
      return;
    }
    if (!estId) {
      alert('Aucun établissement actif.');
      return;
    }
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{')) {
      await importCatalogFromText(text);
      return;
    }
    type Row = {
      name: string;
      category?: string;
      unit?: string;
      price?: number;
      cost?: number;
      min_stock?: number;
      stock?: number;
    };
    let rows: Row[] = [];
    try {
      if (file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data?.type && data.type !== 'stock-manager-catalog') {
          if (!confirm('Ce fichier ne semble pas être un catalogue Stock Manager. Continuer ?')) return;
        }
        const list = Array.isArray(data) ? data : data.products || data.items || [];
        rows = list.map((x: any) => ({
          name: String(x.name || x.nom || '').trim(),
          category: String(x.category || x.categorie || 'Autre'),
          unit: String(x.unit || x.unite || 'unité'),
          price: Number(x.price ?? x.prix_vente ?? 0) || 0,
          cost: Number(x.cost ?? x.prix_achat ?? 0) || 0,
          min_stock: Number(x.min_stock ?? x.stock_min ?? 0) || 0,
          stock: Number(x.stock ?? 0) || 0,
        }));
      } else {
        // CSV ; or ,
        const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          alert('Fichier CSV vide');
          return;
        }
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map((v) => v.replace(/^"|"$/g, '').trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            obj[h] = cols[idx] || '';
          });
          const name = obj.name || obj.nom || obj.produit || '';
          if (!name) continue;
          rows.push({
            name,
            category: obj.category || obj.categorie || 'Autre',
            unit: obj.unit || obj.unite || 'unité',
            price: Number(obj.price || obj.prix_vente || 0) || 0,
            cost: Number(obj.cost || obj.prix_achat || 0) || 0,
            min_stock: Number(obj.min_stock || obj.stock_min || 0) || 0,
            stock: Number(obj.stock || 0) || 0,
          });
        }
      }
    } catch (e) {
      alert('Fichier illisible : ' + (e instanceof Error ? e.message : String(e)));
      return;
    }
    rows = rows.filter((r) => r.name);
    if (!rows.length) {
      alert('Aucun produit trouvé dans le fichier.');
      return;
    }
    if (!confirm(`Importer ${rows.length} produit(s) depuis « ${file.name} » ?\nLes noms déjà présents ne seront pas dupliqués.`)) return;

    const existing = new Set(products.map((p) => p.name.toLowerCase().trim()));
    let added = 0;
    for (const r of rows) {
      if (existing.has(r.name.toLowerCase().trim())) continue;
      const payload = {
        establishment_id: estId,
        name: r.name,
        category: r.category || 'Autre',
        unit: r.unit || 'unité',
        price: r.price || 0,
        cost: r.cost || 0,
        min_stock: r.min_stock || 0,
        stock: r.stock || 0,
      };
      if (isOnline()) {
        const { error } = await supabase.from('products').insert(payload);
        if (!error) {
          added++;
          existing.add(r.name.toLowerCase().trim());
        }
      } else {
        await queueAdd('products', 'insert', { ...payload, _client_op_id: newClientOpId() });
        added++;
        existing.add(r.name.toLowerCase().trim());
      }
    }
    await loadProducts();
    alert(`${added} produit(s) importé(s). ${rows.length - added} ignoré(s) (déjà présents ou erreur).`);
  }

  async function seedCatalog() {
    if (!estId) return;
    if (!confirm(`Importer : ${catalogLabel(bizType)} ? Les produits déjà présents (même nom) ne seront pas dupliqués.`)) return;
    setSeeding(true);
    const existing = new Set(products.map((p) => p.name.toLowerCase()));
    const toInsert = getSeedCatalog(bizType).filter((s) => !existing.has(s.name.toLowerCase())).map((s) => ({
      ...s,
      establishment_id: estId,
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
    if (!canEditStock) { alert('Modification réservée au propriétaire / gérant.'); return; }
    const next = Math.max(0, (Number(p.stock) || 0) + delta);
    const action = delta >= 0 ? `ajouter ${delta}` : `retirer ${Math.abs(delta)}`;
    if (!confirm(`Confirmer : ${action} sur « ${p.name} » ?\nStock : ${p.stock} → ${next}`)) return;
    if (isOnline()) {
      await supabase.from('products').update({ stock: next }).eq('id', p.id);
      await logAudit({
        establishment_id: estId,
        actor_id: member?.user_id,
        actor_name: member?.full_name || member?.email,
        action: 'stock.adjust',
        entity_type: 'product',
        entity_id: p.id,
        entity_label: p.name,
        old_value: { stock: p.stock },
        new_value: { stock: next },
        client_op_id: newClientOpId(),
      });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
      if (estId) {
        await cacheSet(`products:${estId}`, products.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
      }
    } else {
      await queueAdd('products', 'update', { stock: next, _prev_stock: Number(p.stock) || 0 }, { id: p.id });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
    }
  }


  async function receiveArrivage() {
    if (!canEditStock) { alert('Arrivage réservé au propriétaire / gérant.'); return; }
    if (!estId || !arrivageForm.productId || !arrivageForm.qty) {
      alert('Choisissez une boisson et une quantité.');
      return;
    }
    const qty = Number(arrivageForm.qty);
    if (!qty || qty <= 0) {
      alert('Quantité invalide');
      return;
    }
    const p = products.find((x) => x.id === arrivageForm.productId);
    if (!p) {
      alert('Produit introuvable');
      return;
    }
    if (!confirm(`Confirmer l'arrivage de +${qty} « ${p.name} » ?`)) return;
    const next = (Number(p.stock) || 0) + qty;
    if (isOnline()) {
      const { error } = await supabase.from('products').update({ stock: next }).eq('id', p.id);
      if (error) {
        alert(error.message);
        return;
      }
      await logAudit({
        establishment_id: estId,
        actor_id: member?.user_id,
        actor_name: member?.full_name || member?.email,
        action: 'stock.arrival',
        entity_type: 'product',
        entity_id: p.id,
        entity_label: p.name,
        old_value: { stock: p.stock },
        new_value: { stock: next, arrival_qty: qty },
        reason: arrivageForm.note || 'Nouvel arrivage',
        client_op_id: newClientOpId(),
      });
      try {
        await supabase.from('stock_movements').insert({
          establishment_id: estId,
          product_id: p.id,
          product_name: p.name,
          qty: qty,
          movement_type: 'arrival',
          unit_cost: Number(p.cost) || 0,
          unit_price: Number(p.price) || 0,
          reason: 'arrivage',
          note: arrivageForm.note || 'Nouvel arrivage',
          created_by: member?.user_id || null,
        });
      } catch { /* table optionnelle */ }
      // Synchro comptable : arrivage = achat reçu (visible en Comptabilité → Achats)
      try {
        const unitCost = Number(p.cost) || 0;
        const { error: purchErr } = await supabase.from('purchases').insert({
          establishment_id: estId,
          product_id: p.id,
          qty,
          unit_cost: unitCost,
          total: unitCost * qty,
          status: 'received',
          notes: arrivageForm.note || `Arrivage auto — ${p.name}`,
          created_by: member?.user_id || null,
        });
        if (purchErr) {
          console.error('purchase insert', purchErr);
          // Ne bloque pas l'arrivage stock, mais informe
          alert(`Stock OK, mais achat comptable non enregistré: ${purchErr.message}. Vérifiez le prix d'achat (coût) du produit.`);
        }
      } catch (e) {
        console.error(e);
      }
      await loadProducts();
      await loadAudit();
    } else {
      await queueAdd('products', 'update', { stock: next, _prev_stock: Number(p.stock) || 0 }, { id: p.id });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: next } : x)));
    }
    setArrivageForm({ productId: '', qty: '', note: '' });
    setTab('stock');
    alert(`Arrivage enregistré : +${qty} ${p.name}`);
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
        ${showCasiers ? `<td class="num">${casiers}</td>` : ''}
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
      <th>Qté</th>${showCasiers ? '<th>Casiers</th>' : ''}<th>P. achat</th><th>P. vente</th><th>Valeur</th>`;

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
  <h1>${ui.inventoryTitle} physique — Stock Manager AI</h1>
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


  function listenStock() {
    const n = products.length;
    const units = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
    const rupture = products.filter((p) => (Number(p.stock) || 0) <= 0).length;
    const top = [...products]
      .sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0))
      .slice(0, 5)
      .map((p) => `${p.name}, ${Math.floor(Number(p.stock) || 0)}`)
      .join('. ');
    const text =
      `Inventaire. ${n} produits. Total ${Math.floor(units)} unités. ` +
      (rupture ? `Attention, ${rupture} en rupture. ` : 'Pas de rupture. ') +
      (top ? `Principaux stocks : ${top}.` : '');
    playTone(rupture ? 'warn' : 'ok');
    speakFrench(text);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement inventaire…</div>;
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="Aucun établissement"
        message="Vous n'êtes rattaché à aucun établissement."
      />
    );
  }

  return (
    <>
    {!canEditStock && (
      <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <strong>Inventaire en lecture seule.</strong> Ajout, modification, suppression et arrivages sont réservés au <strong>propriétaire</strong>.
        Les boutons d&apos;action sont masqués. Votre rôle : consulter le stock et faire le <strong>rapport du jour</strong>.
      </div>
    )}
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <Package className="text-amber-400" size={26} /> {ui.inventoryTitle}
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {ui.inventorySubtitle}
            {liveNote ? <span className="text-emerald-400 ml-2">· {liveNote}</span> : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { loadProducts(); loadAudit(); }}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Sections inventaire — arrivage / options uniquement propriétaire */}
      {canEditStock ? (
      <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-stone-900 border border-stone-800">
        <button
          type="button"
          onClick={() => setTab('stock')}
          className={`rounded-xl px-2 py-2.5 text-xs sm:text-sm font-medium transition ${
            tab === 'stock' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Package size={16} className="inline mr-1" /> Mon stock
        </button>
        <button
          type="button"
          onClick={() => setTab('arrivage')}
          className={`rounded-xl px-2 py-2.5 text-xs sm:text-sm font-medium transition ${
            tab === 'arrivage' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Truck size={16} className="inline mr-1" /> Nouvel arrivage
        </button>
        <button
          type="button"
          onClick={() => setTab('options')}
          className={`rounded-xl px-2 py-2.5 text-xs sm:text-sm font-medium transition ${
            tab === 'options' ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <MoreHorizontal size={16} className="inline mr-1" /> Plus d&apos;options
        </button>
      </div>
      ) : (
      <div className="rounded-2xl bg-stone-900 border border-stone-800 px-3 py-2.5 text-sm text-stone-400">
          <Package size={16} className="inline mr-1 text-amber-400" /> Consultation du stock uniquement (aucune modification possible)
      </div>
      )}

      {tab === 'arrivage' && canEditStock && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-stone-100 flex items-center gap-2">
            <Truck className="text-amber-400" size={18} /> Enregistrer un arrivage
          </h2>
          <p className="text-sm text-stone-400">
            Ajoutez la quantité reçue : le stock est mis à jour pour toute l&apos;équipe (temps réel).
          </p>
          <div>
            <label className="label">Boisson / produit</label>
            <select
              className="input-field"
              value={arrivageForm.productId}
              onChange={(e) => setArrivageForm({ ...arrivageForm, productId: e.target.value })}
            >
              <option value="">— Choisir —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stock : {p.stock})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantité reçue</label>
              <input
                type="number"
                min={1}
                className="input-field"
                value={arrivageForm.qty}
                onChange={(e) => setArrivageForm({ ...arrivageForm, qty: e.target.value })}
                placeholder="ex: 24"
              />
            </div>
            <div>
              <label className="label">Note (optionnel)</label>
              <input
                className="input-field"
                value={arrivageForm.note}
                onChange={(e) => setArrivageForm({ ...arrivageForm, note: e.target.value })}
                placeholder="Fournisseur, BL…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={receiveArrivage} className="btn-primary">
              Valider l&apos;arrivage
            </button>
            <button type="button" onClick={() => { openAdd(); setTab('stock'); }} className="btn-secondary">
              Nouvelle référence produit
            </button>
          </div>
        </div>
      )}

      {tab === 'options' && canEditStock && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-stone-100 mb-3 flex items-center gap-2">
              <MoreHorizontal size={18} /> Actions inventaire
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              <button type="button" onClick={() => printInventory('blank')} className="btn-secondary flex items-center gap-2 justify-center">
                <Printer size={16} /> Imprimer (manuscrit)
              </button>
              <button type="button" onClick={() => printInventory('stock')} className="btn-secondary flex items-center gap-2 justify-center">
                <Printer size={16} /> Imprimer stock
              </button>
              <button type="button" onClick={() => navigate('/inventory/scan')} className="btn-secondary flex items-center gap-2 justify-center">
                <Camera size={16} /> Scanner photo (IA)
              </button>
              <button type="button" onClick={sendCatalogToTeam} className="btn-secondary flex items-center gap-2 justify-center text-amber-200">
                Envoyer catalogue équipe
              </button>
              <button type="button" onClick={openShareStock} className="btn-primary flex items-center gap-2 justify-center sm:col-span-2">
                <Upload size={16} /> Partager le stock
              </button>
              <button type="button" onClick={() => { setImportText(''); setShareModalOpen(true); }} className="btn-secondary flex items-center gap-2 justify-center sm:col-span-2">
                <Download size={16} /> Recevoir / coller un catalogue
              </button>
              <button type="button" onClick={seedCatalog} disabled={seeding} className="btn-secondary flex items-center gap-2 justify-center">
                <Download size={16} /> {seeding ? 'Import…' : catalogLabel(bizType)}
              </button>
              <button type="button" onClick={openAdd} className="btn-primary flex items-center gap-2 justify-center">
                <Plus size={16} /> Ajouter un produit
              </button>
              {['super_admin','admin','owner'].includes((effectiveRole || member?.role || '') as string) && (
                <button type="button" onClick={resetCatalogStock} className="px-3 py-2 rounded-xl border border-error-500/40 text-error-300 text-sm hover:bg-error-500/10 sm:col-span-2">
                  Remettre tous les stocks à zéro
                </button>
              )}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold text-stone-100 mb-2 flex items-center gap-2">
              <History size={18} className="text-amber-400" /> Historique des mouvements
            </h2>
            <p className="text-xs text-stone-500 mb-3">
              Traces visibles par le propriétaire : arrivages, corrections, créations, suppressions.
            </p>
            {auditRows.length === 0 ? (
              <p className="text-sm text-stone-500">
                Aucune trace pour le moment (ou table audit non encore créée sur Supabase).
              </p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {auditRows.map((a) => {
                  const oldS = a.old_value?.stock;
                  const newS = a.new_value?.stock;
                  const arr = a.new_value?.arrival_qty;
                  const detail =
                    arr != null
                      ? `arrivage +${arr} (stock ${oldS} → ${newS})`
                      : oldS !== undefined && newS !== undefined
                        ? `stock ${oldS} → ${newS}`
                        : a.action;
                  return (
                    <li key={a.id} className="text-sm border-b border-stone-800/80 pb-2">
                      <p className="text-stone-200">
                        <span className="text-amber-300">{a.entity_label || a.entity_type}</span>
                        {' · '}
                        {detail}
                      </p>
                      <p className="text-xs text-stone-500">
                        {a.actor_name || 'Utilisateur'} · {a.action}
                        {a.created_at
                          ? ` · ${new Date(a.created_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                        {a.reason ? ` · ${a.reason}` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'stock' && (
        <div className={!canEditStock ? 'opacity-95 space-y-4' : 'space-y-4'}>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Valeur stock (achat)</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{totals.value.toLocaleString('fr-FR')} <span className="text-sm font-normal">FCFA</span></p>
        </div>
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide">Unités / Casiers</p>
          <p className="text-xl font-bold text-stone-100 mt-1">
            {totals.units}{showCasiers ? <span className="text-sm font-normal text-stone-400"> · {Math.floor(Number(totals.casiers))} casiers</span> : null}
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
      
          <button
            type="button"
            onClick={listenStock}
            className="w-full min-h-[52px] rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 text-amber-100 font-semibold flex items-center justify-center gap-2 mb-3"
          >
            <Volume2 size={22} /> Écouter le stock
          </button>
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
        {canEditStock && (
        <button type="button" onClick={openAdd} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={18} /> Ajouter
        </button>
        )}
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
          message={`Cliquez sur « ${catalogLabel(bizType)} » pour démarrer, ou « Ajouter ».`}
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
                {showCasiers && (
                <th className="px-3 py-3 font-medium text-right">
                  <span className="inline-flex items-center gap-1"><Calculator size={12} /> Casiers</span>
                </th>
                )}
                <th className="px-3 py-3 font-medium text-right">Achat</th>
                <th className="px-3 py-3 font-medium text-right">Vente</th>
                <th className="px-3 py-3 font-medium text-right">Valeur stock</th>
                <th className="px-3 py-3 font-medium text-center">Statut IA</th>
                {canEditStock && <th className="px-3 py-3 font-medium text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = Number(p.stock) || 0;
                const min = Number(p.min_stock) || 0;
                const cost = Number(p.cost) || 0;
                const price = Number(p.price) || 0;
                const pack = Math.max(1, Number(p.units_per_package) || CASIER);
                const casiers = Math.floor(stock / pack);
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
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <ProductThumb name={p.name} category={p.category} imageUrl={(p as { image_url?: string }).image_url} size={44} />
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          {low && <AlertTriangle size={14} className="text-amber-400 shrink-0" />}
                          <span className="truncate">{p.name}</span>
                          {(Number(p.empty_bottles) > 0 || Number(p.consigne_unit) > 0) && (
                            <span className="text-[10px] text-sky-400/90 block">
                              {Number(p.consigne_unit) > 0 ? `Consigne ${p.consigne_unit}F` : ''}
                              {Number(p.empty_bottles) > 0 ? ` · ${p.empty_bottles} vides` : ''}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-stone-400">{p.unit}</td>
                    <td className="px-3 py-2.5 text-right">
                      {canEditStock ? (
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
                      ) : (
                        <span className={`font-semibold ${low ? 'text-amber-300' : 'text-stone-100'}`}>{stock}</span>
                      )}
                    </td>
                    {showCasiers && <td className="px-3 py-2.5 text-right text-stone-400">{casiers}</td>}
                    <td className="px-3 py-2.5 text-right text-stone-400">{cost.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-right text-stone-300">{price.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-amber-300/90">{valeur.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge color={status.color}>{status.label}</Badge>
                    </td>
                    {canEditStock && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-stone-200">
                          <Pencil size={16} />
                        </button>
                        <button type="button" onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-400 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-700 bg-stone-800/60 font-semibold text-stone-100">
                <td className="px-3 py-3" colSpan={3}>TOTAL</td>
                <td className="px-3 py-3 text-right">{totals.units}</td>
                {showCasiers && <td className="px-3 py-3 text-right">{Math.floor(Number(totals.casiers))}</td>}
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
        Casiers = Qté ÷ unités/casier (12 ou 24) · Valeur stock = Qté × prix d&apos;achat · Statut IA : RUPTURE / À COMMANDER / SURVEILLER / OK selon stock min.
      </p>
        </div>
      )}

      {/* Modal add/edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le produit' : 'Nouveau produit'}>
        <div className="space-y-3">
          <div>
            <label className="label">Nom / Marque</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder={`ex: ${ui.productSingular || "article"}`} />
          </div>
          <div>
            <label className="label">Image de la boisson (paramètres)</label>
            <div className="flex items-start gap-3">
              <ProductThumb name={form.name} category={form.category} imageUrl={form.image_url || null} size={56} />
              <div className="flex-1 space-y-2">
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="input-field text-sm"
                  placeholder="https://… lien de l'image (optionnel)"
                />
                <label className="btn-secondary text-xs inline-flex items-center gap-1 cursor-pointer">
                  Choisir une photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 1.5 * 1024 * 1024) {
                        alert('Image trop lourde (max 1,5 Mo). Compressez-la ou utilisez un lien.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const data = String(reader.result || '');
                        if (data.length > 1_200_000) {
                          alert('Image trop grande après lecture. Utilisez un lien URL plus léger.');
                          return;
                        }
                        setForm((prev) => ({ ...prev, image_url: data }));
                      };
                      reader.readAsDataURL(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {form.image_url && (
                  <button
                    type="button"
                    className="text-xs text-red-300 hover:underline"
                    onClick={() => setForm({ ...form, image_url: '' })}
                  >
                    Supprimer l&apos;image personnalisée
                  </button>
                )}
                <p className="text-[11px] text-stone-500">
                  Photo ou lien https://… Enregistrer pour appliquer. Sinon photo auto selon le nom.
                </p>
              </div>
            </div>
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
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field" placeholder={ui.unitDefault || "unité"} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">U / casier</label>
              <input type="number" min={1} value={form.units_per_package} onChange={(e) => setForm({ ...form, units_per_package: e.target.value })} className="input-field" placeholder="12 ou 24" />
            </div>
            <div>
              <label className="label">Consigne (F)</label>
              <input type="number" min={0} value={form.consigne_unit} onChange={(e) => setForm({ ...form, consigne_unit: e.target.value })} className="input-field" placeholder="ex: 150" />
            </div>
            <div>
              <label className="label">Vides</label>
              <input type="number" min={0} value={form.empty_bottles} onChange={(e) => setForm({ ...form, empty_bottles: e.target.value })} className="input-field" placeholder="0" />
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
                {showCasiers ? `${Math.floor(Number(form.stock) / CASIER)} casiers · ` : ''}
                {((Number(form.stock) || 0) * (Number(form.cost) || 0)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
          <button onClick={save} className="btn-primary w-full">{editing ? 'Enregistrer' : 'Ajouter au stock'}</button>
        </div>
      </Modal>

      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Partager / importer le stock">
        <div className="space-y-3">
          <p className="text-sm text-stone-400">
            Sur téléphone, utilisez <strong className="text-stone-200">Partager</strong> ou <strong className="text-stone-200">Copier</strong>,
            puis sur l&apos;autre appareil <strong className="text-stone-200">Collez</strong> le catalogue ci-dessous.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button type="button" disabled={shareBusy || !products.length} onClick={() => void shareStockNative()} className="btn-primary">
              {shareBusy ? 'Patientez…' : 'Partager maintenant'}
            </button>
            <button type="button" disabled={!products.length} onClick={() => void copyCatalog()} className="btn-secondary">
              Copier le catalogue
            </button>
            <button type="button" disabled={!products.length} onClick={shareStockWhatsApp} className="btn-secondary">
              Envoyer résumé WhatsApp
            </button>
            <button type="button" disabled={!products.length} onClick={() => setImportText(catalogJsonText())} className="btn-secondary">
              Afficher le texte à copier
            </button>
          </div>
          <div>
            <label className="label">Coller un catalogue reçu (JSON)</label>
            <textarea
              className="input-field min-h-[140px] font-mono text-xs"
              placeholder='Collez ici le texte {"version":1,"type":"stock-manager-catalog",...}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => void importCatalogFromText(importText)}
          >
            Importer le texte collé
          </button>
        </div>
      </Modal>

    </div>
    </>
  );
}