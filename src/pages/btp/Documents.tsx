import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, FileText, Copy, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  formatMoney, nextDocNumber, lineHT, DOC_TYPE_LABELS, DOC_STATUS_LABELS,
  DEFAULT_BRANDING, type BtpDocType, type BtpDocStatus, type BtpBranding,
} from '@/lib/btp';

type Item = {
  id?: string;
  item_type: 'item' | 'section';
  title: string;
  unit: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  total_ht: number;
};

export default function BtpDocuments() {
  const { member, activeEstablishment } = useAuth();
  const est = activeEstablishment?.id || member?.establishment_id;
  const [docs, setDocs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | BtpDocType>('all');
  const [printDoc, setPrintDoc] = useState<any | null>(null);
  const [printItems, setPrintItems] = useState<any[]>([]);
  const [branding, setBranding] = useState<BtpBranding>({ ...DEFAULT_BRANDING });
  const [company, setCompany] = useState<{ name?: string; address?: string; phone?: string; logo_url?: string }>({});

  const [form, setForm] = useState({
    id: '' as string,
    type: 'quote' as BtpDocType,
    title: '',
    date: new Date().toISOString().slice(0, 10),
    validity_date: '',
    client_id: '',
    client_name: '',
    client_phone: '',
    site_location: '',
    status: 'draft' as BtpDocStatus,
    notes: '',
    payment_terms: '',
    global_discount_percent: 0,
    advance_percent: 30,
    amount_paid: 0,
  });
  const [items, setItems] = useState<Item[]>([
    { item_type: 'item', title: '', unit: 'u', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0, total_ht: 0 },
  ]);

  async function load() {
    if (!est) return;
    setLoading(true);
    const [d, c, m, e] = await Promise.all([
      supabase.from('btp_documents').select('*').eq('establishment_id', est).order('created_at', { ascending: false }),
      supabase.from('btp_clients').select('*').eq('establishment_id', est).order('name'),
      supabase.from('btp_materials').select('*').eq('establishment_id', est).order('name'),
      supabase.from('establishments').select('name, address, phone, logo_url, branding').eq('id', est).maybeSingle(),
    ]);
    setDocs(d.data || []);
    setClients(c.data || []);
    setMaterials(m.data || []);
    if (e.data) {
      setCompany({
        name: e.data.name,
        address: e.data.address || '',
        phone: e.data.phone || '',
        logo_url: (e.data as any).logo_url || '',
      });
      const br = (e.data as any).branding;
      if (br && typeof br === 'object') setBranding({ ...DEFAULT_BRANDING, ...br });
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [est]);

  const totals = useMemo(() => {
    const lines = items.filter((i) => i.item_type === 'item');
    let ht = lines.reduce((s, i) => s + lineHT(i.quantity, i.unit_price, i.discount_percent), 0);
    ht = ht * (1 - Number(form.global_discount_percent) / 100);
    const tax = lines.reduce((s, i) => {
      const lht = lineHT(i.quantity, i.unit_price, i.discount_percent) * (1 - Number(form.global_discount_percent) / 100);
      return s + lht * (Number(i.tax_rate) / 100);
    }, 0);
    const ttc = ht + tax;
    const advance = ttc * (Number(form.advance_percent) / 100);
    const paid = Number(form.amount_paid) || 0;
    return { ht, tax, ttc, advance, balance: Math.max(0, ttc - paid) };
  }, [items, form.global_discount_percent, form.advance_percent, form.amount_paid]);

  function startNew(type: BtpDocType = 'quote') {
    setForm({
      id: '',
      type,
      title: type === 'quote' ? 'Devis travaux' : 'Facture travaux',
      date: new Date().toISOString().slice(0, 10),
      validity_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      client_id: '',
      client_name: '',
      client_phone: '',
      site_location: '',
      status: 'draft',
      notes: '',
      payment_terms: branding.payment_terms_default || 'Acompte 30 % à la commande, solde à la livraison',
      global_discount_percent: 0,
      advance_percent: 30,
      amount_paid: 0,
    });
    setItems([{ item_type: 'item', title: '', unit: 'u', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0, total_ht: 0 }]);
    setEditing(true);
    setError(null);
  }

  async function openPrint(doc: any) {
    const { data } = await supabase.from('btp_document_items').select('*').eq('document_id', doc.id).order('sort_order');
    setPrintItems(data || []);
    setPrintDoc(doc);
  }

  async function openEdit(doc: any) {
    setForm({
      id: doc.id,
      type: doc.type,
      title: doc.title || '',
      date: doc.date,
      validity_date: doc.validity_date || '',
      client_id: doc.client_id || '',
      client_name: doc.client_name || '',
      client_phone: doc.client_phone || '',
      site_location: doc.site_location || '',
      status: doc.status,
      notes: doc.notes || '',
      payment_terms: doc.payment_terms || '',
      global_discount_percent: Number(doc.global_discount_percent) || 0,
      advance_percent: Number(doc.advance_percent) || 0,
      amount_paid: Number(doc.amount_paid) || 0,
    });
    const { data } = await supabase.from('btp_document_items').select('*').eq('document_id', doc.id).order('sort_order');
    setItems(
      (data || []).map((x: any) => ({
        id: x.id,
        item_type: x.item_type === 'section' ? 'section' : 'item',
        title: x.title,
        unit: x.unit || 'u',
        quantity: Number(x.quantity) || 1,
        unit_price: Number(x.unit_price) || 0,
        tax_rate: Number(x.tax_rate) || 0,
        discount_percent: Number(x.discount_percent) || 0,
        total_ht: Number(x.total_ht) || 0,
      })),
    );
    if (!data?.length) {
      setItems([{ item_type: 'item', title: '', unit: 'u', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0, total_ht: 0 }]);
    }
    setEditing(true);
  }

  async function save() {
    if (!est || !member) return;
    const valid = items.filter((i) => i.item_type === 'section' || i.title.trim());
    if (!valid.length) {
      setError('Ajoutez au moins une ligne');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      establishment_id: est,
      type: form.type,
      doc_number: form.id ? docs.find((d) => d.id === form.id)?.doc_number : nextDocNumber(form.type, docs),
      title: form.title.trim() || DOC_TYPE_LABELS[form.type],
      date: form.date,
      validity_date: form.validity_date || null,
      client_id: form.client_id || null,
      client_name: form.client_name || clients.find((c) => c.id === form.client_id)?.name || null,
      client_phone: form.client_phone || clients.find((c) => c.id === form.client_id)?.phone || null,
      site_location: form.site_location || null,
      global_discount_percent: form.global_discount_percent,
      total_ht: totals.ht,
      total_tax: totals.tax,
      total_ttc: totals.ttc,
      advance_percent: form.advance_percent,
      advance_amount: totals.advance,
      amount_paid: form.amount_paid,
      balance_due: totals.balance,
      status: form.status,
      notes: form.notes || null,
      payment_terms: form.payment_terms || null,
      created_by: member.user_id,
      updated_at: new Date().toISOString(),
    };

    let docId = form.id;
    if (form.id) {
      const { error: e } = await supabase.from('btp_documents').update(payload).eq('id', form.id);
      if (e) { setError(e.message); setSaving(false); return; }
      await supabase.from('btp_document_items').delete().eq('document_id', form.id);
    } else {
      const { data, error: e } = await supabase.from('btp_documents').insert(payload).select('id').single();
      if (e || !data) { setError(e?.message || 'Erreur'); setSaving(false); return; }
      docId = data.id;
    }

    const rows = valid.map((it, idx) => ({
      document_id: docId,
      sort_order: idx,
      item_type: it.item_type,
      title: it.title,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tax_rate: it.tax_rate,
      discount_percent: it.discount_percent,
      total_ht: it.item_type === 'item' ? lineHT(it.quantity, it.unit_price, it.discount_percent) : 0,
    }));
    const { error: e2 } = await supabase.from('btp_document_items').insert(rows);
    if (e2) setError(e2.message);
    setSaving(false);
    setEditing(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.from('btp_documents').delete().eq('id', id);
    await load();
  }

  async function convertToInvoice(doc: any) {
    if (doc.type !== 'quote') return;
    const num = nextDocNumber('invoice', docs);
    const { data: itemsData } = await supabase.from('btp_document_items').select('*').eq('document_id', doc.id).order('sort_order');
    const { data: inv, error } = await supabase.from('btp_documents').insert({
      ...doc,
      id: undefined,
      type: 'invoice',
      doc_number: num,
      title: `Facture — ${doc.title}`,
      status: 'sent',
      date: new Date().toISOString().slice(0, 10),
      converted_from_quote_id: doc.id,
      created_at: undefined,
      updated_at: new Date().toISOString(),
    }).select('id').single();
    if (error || !inv) { setError(error?.message || 'Erreur conversion'); return; }
    if (itemsData?.length) {
      await supabase.from('btp_document_items').insert(
        itemsData.map((x: any, idx: number) => ({
          document_id: inv.id,
          sort_order: idx,
          item_type: x.item_type,
          title: x.title,
          unit: x.unit,
          quantity: x.quantity,
          unit_price: x.unit_price,
          tax_rate: x.tax_rate,
          discount_percent: x.discount_percent,
          total_ht: x.total_ht,
        })),
      );
    }
    await supabase.from('btp_documents').update({ status: 'accepted' }).eq('id', doc.id);
    await load();
  }

  function addMaterialLine(mat: any) {
    setItems((prev) => [
      ...prev,
      {
        item_type: 'item',
        title: mat.name,
        unit: mat.unit || 'u',
        quantity: 1,
        unit_price: Number(mat.default_price) || 0,
        tax_rate: Number(mat.default_tax_rate) || 0,
        discount_percent: 0,
        total_ht: Number(mat.default_price) || 0,
      },
    ]);
  }

  const visible = filter === 'all' ? docs : docs.filter((d) => d.type === filter);


  if (printDoc) {
    const d = printDoc;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 no-print">
          <button type="button" className="btn-ghost text-sm" onClick={() => setPrintDoc(null)}>Retour</button>
          <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>Imprimer / PDF</button>
        </div>
        <div className="btp-print-sheet bg-white text-stone-900 rounded-xl p-6 max-w-3xl mx-auto shadow print:shadow-none print:max-w-none">
          {/* EN-TÊTE */}
          <header className="flex gap-4 border-b-2 border-sky-600 pb-4 mb-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="h-16 w-16 object-contain rounded" />
            ) : (
              <div className="h-16 w-16 rounded bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-lg">
                {(company.name || 'B').slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-sky-800 leading-tight">{company.name || 'Entreprise'}</h1>
              {branding.activity && <p className="text-sm text-stone-600">{branding.activity}</p>}
              {branding.slogan && <p className="text-xs italic text-stone-500">{branding.slogan}</p>}
              {branding.header_note && <p className="text-xs text-sky-700 mt-0.5">{branding.header_note}</p>}
              <p className="text-xs text-stone-600 mt-1">
                {[company.address, branding.city, branding.country].filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-stone-600">
                {[company.phone, branding.email, branding.website].filter(Boolean).join(' · ')}
              </p>
              <p className="text-[10px] text-stone-500 mt-0.5">
                {[branding.rccm && `RCCM ${branding.rccm}`, branding.nif && `NIF ${branding.nif}`, branding.tva_number && `TVA ${branding.tva_number}`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-sky-700 uppercase">{DOC_TYPE_LABELS[d.type as BtpDocType] || d.type}</p>
              <p className="text-sm font-semibold">{d.doc_number}</p>
              <p className="text-xs text-stone-500">Date : {d.date}</p>
              {d.validity_date && <p className="text-xs text-stone-500">Validité : {d.validity_date}</p>}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div className="rounded-lg bg-stone-50 p-3 border border-stone-200">
              <p className="text-[10px] uppercase text-stone-500 font-semibold mb-1">Client</p>
              <p className="font-semibold">{d.client_name || '—'}</p>
              {d.client_phone && <p className="text-xs">{d.client_phone}</p>}
              {d.site_location && <p className="text-xs mt-1">Chantier : {d.site_location}</p>}
            </div>
            <div className="rounded-lg bg-stone-50 p-3 border border-stone-200">
              <p className="text-[10px] uppercase text-stone-500 font-semibold mb-1">Document</p>
              <p className="font-medium">{d.title}</p>
              <p className="text-xs">Statut : {DOC_STATUS_LABELS[d.status as BtpDocStatus] || d.status}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse mb-4">
            <thead>
              <tr className="bg-sky-700 text-white">
                <th className="text-left p-2">Désignation</th>
                <th className="text-right p-2">Qté</th>
                <th className="text-right p-2">P.U.</th>
                <th className="text-right p-2">HT</th>
              </tr>
            </thead>
            <tbody>
              {printItems.map((it: any) =>
                it.item_type === 'section' ? (
                  <tr key={it.id} className="bg-stone-100">
                    <td colSpan={4} className="p-2 font-semibold text-sky-900">{it.title}</td>
                  </tr>
                ) : (
                  <tr key={it.id} className="border-b border-stone-200">
                    <td className="p-2">{it.title}</td>
                    <td className="p-2 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                    <td className="p-2 text-right">{formatMoney(it.unit_price)}</td>
                    <td className="p-2 text-right font-medium">{formatMoney(it.total_ht)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-4">
            <div className="w-56 text-sm space-y-1">
              <div className="flex justify-between"><span>Total HT</span><span>{formatMoney(d.total_ht)}</span></div>
              <div className="flex justify-between"><span>TVA</span><span>{formatMoney(d.total_tax)}</span></div>
              <div className="flex justify-between font-bold text-sky-800 text-base border-t border-stone-300 pt-1">
                <span>Total TTC</span><span>{formatMoney(d.total_ttc)}</span>
              </div>
              {Number(d.advance_amount) > 0 && (
                <div className="flex justify-between text-xs text-stone-600"><span>Acompte</span><span>{formatMoney(d.advance_amount)}</span></div>
              )}
              <div className="flex justify-between text-xs"><span>Reste dû</span><span>{formatMoney(d.balance_due)}</span></div>
            </div>
          </div>

          {(d.payment_terms || branding.payment_terms_default) && (
            <p className="text-xs text-stone-600 mb-2"><strong>Paiement :</strong> {d.payment_terms || branding.payment_terms_default}</p>
          )}
          {d.notes && <p className="text-xs text-stone-600 mb-2"><strong>Notes :</strong> {d.notes}</p>}
          {branding.legal_notice && <p className="text-[10px] text-stone-500 mb-3">{branding.legal_notice}</p>}

          {(branding.mobile_money || branding.bank_name || branding.iban) && (
            <div className="text-xs text-stone-600 border border-stone-200 rounded-lg p-2 mb-3">
              <p className="font-semibold text-stone-700 mb-0.5">Règlement</p>
              {branding.mobile_money && <p>Mobile Money : {branding.mobile_money}</p>}
              {branding.bank_name && <p>Banque : {branding.bank_name}</p>}
              {branding.iban && <p>Compte : {branding.iban}</p>}
            </div>
          )}

          {/* PIED DE PAGE */}
          <footer className="border-t border-stone-300 pt-3 mt-4 flex items-end justify-between gap-4">
            <div className="text-[10px] text-stone-500 flex-1">
              <p>{branding.footer_text || 'Merci de votre confiance.'}</p>
              <p className="mt-1">{company.name} · {[company.phone, branding.email].filter(Boolean).join(' · ')}</p>
            </div>
            {branding.stamp_url && (
              <img src={branding.stamp_url} alt="Cachet" className="h-16 object-contain opacity-90" />
            )}
          </footer>
        </div>
        <style>{`@media print { .no-print { display: none !important; } body { background: white; } .btp-print-sheet { box-shadow: none; } }`}</style>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-stone-100">{form.id ? 'Modifier' : 'Nouveau'} {DOC_TYPE_LABELS[form.type]}</h1>
          <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(false)}>Retour</button>
        </div>
        {error && <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as BtpDocType })} disabled={!!form.id}>
                <option value="quote">Devis</option>
                <option value="invoice">Facture</option>
                <option value="situation">Situation</option>
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BtpDocStatus })}>
                {Object.entries(DOC_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Titre</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Validité</label>
              <input type="date" className="input-field" value={form.validity_date} onChange={(e) => setForm({ ...form, validity_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Client</label>
            <select
              className="input-field"
              value={form.client_id}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                setForm({
                  ...form,
                  client_id: e.target.value,
                  client_name: c?.name || '',
                  client_phone: c?.phone || '',
                  site_location: c?.site_address || form.site_location,
                });
              }}
            >
              <option value="">— Choisir ou saisir —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
              ))}
            </select>
            <input className="input-field mt-2" placeholder="Nom client" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            <input className="input-field mt-2" placeholder="Téléphone" value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Chantier / lieu</label>
            <input className="input-field" value={form.site_location} onChange={(e) => setForm({ ...form, site_location: e.target.value })} />
          </div>
        </div>

        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-stone-100">Lignes</h2>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setItems((p) => [...p, { item_type: 'section', title: 'Section', unit: '', quantity: 0, unit_price: 0, tax_rate: 0, discount_percent: 0, total_ht: 0 }])}>+ Section</button>
              <button type="button" className="btn-primary text-xs" onClick={() => setItems((p) => [...p, { item_type: 'item', title: '', unit: 'u', quantity: 1, unit_price: 0, tax_rate: 0, discount_percent: 0, total_ht: 0 }])}>+ Ligne</button>
            </div>
          </div>
          {materials.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {materials.slice(0, 12).map((m) => (
                <button key={m.id} type="button" className="text-[11px] px-2 py-1 rounded-full bg-stone-800 text-stone-300 hover:bg-sky-900/40" onClick={() => addMaterialLine(m)}>
                  + {m.name}
                </button>
              ))}
            </div>
          )}
          {items.map((it, idx) => (
            <div key={idx} className={`rounded-xl border border-stone-700 p-2 space-y-2 ${it.item_type === 'section' ? 'bg-stone-800/40' : ''}`}>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder={it.item_type === 'section' ? 'Titre section' : 'Désignation'}
                  value={it.title}
                  onChange={(e) => {
                    const n = [...items];
                    n[idx] = { ...it, title: e.target.value };
                    setItems(n);
                  }}
                />
                <button type="button" className="text-red-400 p-2" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={16} /></button>
              </div>
              {it.item_type === 'item' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input type="number" className="input-field" placeholder="Qté" value={it.quantity} onChange={(e) => { const n = [...items]; n[idx] = { ...it, quantity: Number(e.target.value) }; setItems(n); }} />
                  <input className="input-field" placeholder="Unité" value={it.unit} onChange={(e) => { const n = [...items]; n[idx] = { ...it, unit: e.target.value }; setItems(n); }} />
                  <input type="number" className="input-field" placeholder="P.U." value={it.unit_price} onChange={(e) => { const n = [...items]; n[idx] = { ...it, unit_price: Number(e.target.value) }; setItems(n); }} />
                  <input type="number" className="input-field" placeholder="TVA %" value={it.tax_rate} onChange={(e) => { const n = [...items]; n[idx] = { ...it, tax_rate: Number(e.target.value) }; setItems(n); }} />
                </div>
              )}
              {it.item_type === 'item' && (
                <p className="text-xs text-stone-400 text-right">HT ligne : {formatMoney(lineHT(it.quantity, it.unit_price, it.discount_percent))}</p>
              )}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-800">
            <div>
              <label className="label">Remise globale %</label>
              <input type="number" className="input-field" value={form.global_discount_percent} onChange={(e) => setForm({ ...form, global_discount_percent: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Acompte %</label>
              <input type="number" className="input-field" value={form.advance_percent} onChange={(e) => setForm({ ...form, advance_percent: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Déjà payé</label>
              <input type="number" className="input-field" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })} />
            </div>
          </div>
          <div className="text-sm space-y-1 text-right">
            <p className="text-stone-400">Total HT : <span className="text-stone-100 font-medium">{formatMoney(totals.ht)}</span></p>
            <p className="text-stone-400">TVA : <span className="text-stone-100 font-medium">{formatMoney(totals.tax)}</span></p>
            <p className="text-lg font-bold text-sky-400">Total TTC : {formatMoney(totals.ttc)}</p>
            <p className="text-stone-400">Acompte : {formatMoney(totals.advance)} · Reste : {formatMoney(totals.balance)}</p>
          </div>
          <textarea className="input-field min-h-[60px]" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <textarea className="input-field min-h-[50px]" placeholder="Conditions de paiement" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
          <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void save()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-stone-100 flex items-center gap-2"><FileText className="text-sky-400" /> Devis & factures</h1>
          <p className="text-sm text-stone-500">BatiDevis — documents chantier</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => startNew('invoice')}>+ Facture</button>
          <button type="button" className="btn-primary text-sm" onClick={() => startNew('quote')}><Plus size={16} /> Devis</button>
        </div>
      </div>
      <div className="flex gap-2">
        {(['all', 'quote', 'invoice', 'situation'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full ${filter === f ? 'bg-sky-500/20 text-sky-300' : 'bg-stone-800 text-stone-400'}`}>
            {f === 'all' ? 'Tous' : DOC_TYPE_LABELS[f]}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-stone-500">Chargement…</p>
      ) : visible.length === 0 ? (
        <div className="card text-center py-10 text-stone-500">Aucun document. Créez un devis.</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => (
            <li key={d.id} className="card flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="button" className="flex-1 text-left min-w-0" onClick={() => void openEdit(d)}>
                <p className="font-medium text-stone-100 truncate">{d.doc_number} · {d.title}</p>
                <p className="text-xs text-stone-500">{DOC_TYPE_LABELS[d.type as BtpDocType]} · {d.client_name || 'Sans client'} · {d.date}</p>
                <p className="text-sm text-sky-400 font-semibold mt-1">{formatMoney(d.total_ttc)} · {DOC_STATUS_LABELS[d.status as BtpDocStatus]}</p>
              </button>
              <div className="flex gap-2 shrink-0">
                {d.type === 'quote' && (
                  <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1" onClick={() => void convertToInvoice(d)}>
                    <ArrowRight size={14} /> Facturer
                  </button>
                )}
                <button type="button" className="text-red-400 p-2" onClick={() => void remove(d.id)}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-600"><Link to="/btp/clients" className="text-sky-400 underline">Clients</Link> · <Link to="/btp/materials" className="text-sky-400 underline">Matériaux</Link></p>
    </div>
  );
}
