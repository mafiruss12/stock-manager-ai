import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Calendar, DollarSign, Smartphone, Loader2, Send, Save,
  Beer, CheckCircle2, AlertTriangle, MessageCircle, FileText, RefreshCw,
  History, PackageMinus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import type { Product } from '@/lib/types';
import { EmptyState, Badge } from '@/components/ui';
import { formatFCFA } from '@/lib/format';
import { buildWhatsAppLink, normalizeBusinessType } from '@/lib/businessTypes';
import { notifyOwnerOnReport, getOwnerContacts, openOwnerChannelsAfterReport } from '@/lib/notifyOwner';
import { ROLE_LABELS } from '@/lib/types';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

type Line = { product_id: string; name: string; price: number; cost: number; qty: number };

type SavedPayload = {
  items: Line[];
  cash_counted: number;
  mobile_counted: number;
  theoretical: number;
  match: boolean;
  comment: string;
  signature: string;
  stock_deducted?: boolean;
  sent_at?: string;
};

type HistoryRow = {
  id: string;
  date: string;
  total_sales: number;
  cash: number;
  mobile_money?: number;
  sent_at?: string | null;
  notes?: string | null;
  signature?: string | null;
};

export default function DailyReportPage() {
  const { member, activeEstablishment } = useAuth();
  const estId = useEstId();
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const [date, setDate] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('date');
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    } catch { /* */ }
    return todayISO();
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const [cashCounted, setCashCounted] = useState('');
  const [mobileCounted, setMobileCounted] = useState('');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState(member?.full_name || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [stockDeducted, setStockDeducted] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const lines: Line[] = useMemo(() => {
    return products.map((p) => ({
      product_id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      cost: Number(p.cost) || 0,
      qty: Math.max(0, Math.floor(Number(qtyMap[p.id]) || 0)),
    }));
  }, [products, qtyMap]);

  const soldLines = useMemo(() => lines.filter((l) => l.qty > 0), [lines]);
  const theoretical = useMemo(
    () => soldLines.reduce((s, l) => s + l.qty * l.price, 0),
    [soldLines]
  );
  const cash = Number(cashCounted) || 0;
  const mobile = Number(mobileCounted) || 0;
  const received = cash + mobile;
  const diff = theoretical - received;
  const match = Math.abs(diff) < 1;

  async function loadHistory() {
    if (!estId) return;
    const { data } = await supabase
      .from('daily_reports')
      .select('id, date, total_sales, cash, mobile_money, sent_at, notes, signature')
      .eq('establishment_id', estId)
      .order('date', { ascending: false })
      .limit(30);
    setHistory((data as HistoryRow[]) || []);
  }

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: prods }, { data: existing }] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('establishment_id', estId)
        .order('name'),
      supabase
        .from('daily_reports')
        .select('*')
        .eq('establishment_id', estId)
        .eq('date', date)
        .maybeSingle(),
    ]);

    const list = (prods ?? []) as Product[];
    setProducts(list);

    try {
      const owner = await getOwnerContacts(estId);
      setOwnerPhone(owner?.owner_phone || null);
    } catch {
      setOwnerPhone(null);
    }

    if (existing) {
      setReportId(existing.id);
      setSent(Boolean((existing as any).sent_at));
      setSignature(existing.signature || member?.full_name || '');
      try {
        const raw = existing.notes || '';
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw) as SavedPayload;
          const map: Record<string, string> = {};
          (parsed.items || []).forEach((it) => {
            map[it.product_id] = String(it.qty);
          });
          setQtyMap(map);
          setCashCounted(String(parsed.cash_counted ?? existing.cash ?? ''));
          setMobileCounted(String(parsed.mobile_counted ?? (existing as any).mobile_money ?? ''));
          setComment(parsed.comment || '');
          setStockDeducted(Boolean(parsed.stock_deducted));
          if ((parsed.items || []).some((i) => i.qty > 0)) setStep(2);
        } else {
          setComment(raw);
          setCashCounted(String(existing.cash ?? ''));
          setMobileCounted(String((existing as any).mobile_money ?? ''));
        }
      } catch {
        setComment(existing.notes || '');
      }
    } else {
      setReportId(null);
      setSent(false);
      setStockDeducted(false);
      setQtyMap({});
      setCashCounted('');
      setMobileCounted('');
      setComment('');
      setStep(1);
    }
    await loadHistory();
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId, date]);

  function buildPayload(extra?: Partial<SavedPayload>): SavedPayload {
    return {
      items: soldLines,
      cash_counted: cash,
      mobile_counted: mobile,
      theoretical,
      match,
      comment,
      signature,
      stock_deducted: stockDeducted,
      ...extra,
    };
  }

  async function saveReport(markSent: boolean, payloadOverride?: SavedPayload) {
    if (!estId) return null;
    const payload = payloadOverride || buildPayload(markSent ? { sent_at: new Date().toISOString() } : {});
    const row: Record<string, unknown> = {
      establishment_id: estId,
      date,
      total_sales: theoretical,
      total_expenses: 0,
      cash,
      mobile_money: mobile,
      losses: match ? 0 : Math.abs(diff),
      broken: 0,
      notes: JSON.stringify(payload),
      signature,
      locked: false,
    };
    if (markSent) row.sent_at = new Date().toISOString();

    if (reportId) {
      const { error } = await supabase.from('daily_reports').update(row).eq('id', reportId);
      if (error && String(error.message).includes('sent_at')) {
        const { sent_at: _s, ...rest } = row;
        await supabase.from('daily_reports').update(rest).eq('id', reportId);
      }
      return reportId;
    }
    const { data, error } = await supabase.from('daily_reports').insert(row).select('id').maybeSingle();
    if (error) {
      const { sent_at: _s, ...rest } = row;
      const { data: d2 } = await supabase.from('daily_reports').insert(rest).select('id').maybeSingle();
      if (d2?.id) {
        setReportId(d2.id);
        return d2.id;
      }
      return null;
    }
    if (data?.id) {
      setReportId(data.id);
      return data.id;
    }
    return null;
  }

  /** Déduit le stock des boissons vendues (une seule fois) */
  async function deductStock(): Promise<boolean> {
    if (!estId || stockDeducted || soldLines.length === 0) return stockDeducted;
    let ok = true;
    for (const line of soldLines) {
      const prod = products.find((p) => p.id === line.product_id);
      if (!prod) continue;
      const next = Math.max(0, Math.floor(Number(prod.stock) || 0) - line.qty);
      const { error } = await supabase.from('products').update({ stock: next }).eq('id', line.product_id);
      if (error) {
        ok = false;
        continue;
      }
      // trace optionnelle
      try {
        await supabase.from('stock_movements').insert({
          establishment_id: estId,
          product_id: line.product_id,
          product_name: line.name,
          qty: -line.qty,
          movement_type: 'report_sale',
          unit_cost: line.cost || Number(prod.cost) || 0,
          unit_price: line.price || Number(prod.price) || 0,
          reason: 'rapport_du_jour',
          note: `Rapport ${date}`,
          created_by: member?.user_id || null,
        });
      } catch {
        /* table peut ne pas exister */
      }
    }
    if (ok) {
      setStockDeducted(true);
      setProducts((prev) =>
        prev.map((p) => {
          const line = soldLines.find((l) => l.product_id === p.id);
          if (!line) return p;
          return { ...p, stock: Math.max(0, Math.floor(Number(p.stock) || 0) - line.qty) };
        })
      );
    }
    return ok;
  }

  function reportText(): string {
    const est = activeEstablishment?.name || 'Maquis';
    const linesTxt = soldLines
      .map((l) => `• ${l.name} × ${l.qty} = ${formatFCFA(l.qty * l.price)}`)
      .join('\n');
    return (
      `📋 *Rapport du jour — ${est}*\n` +
      `📅 Date : ${date}\n\n` +
      `🍺 *Boissons vendues*\n${linesTxt || 'Aucune'}\n\n` +
      `💰 Total théorique : *${formatFCFA(theoretical)}*\n` +
      `💵 Espèces : ${formatFCFA(cash)}\n` +
      `📱 Mobile Money : ${formatFCFA(mobile)}\n` +
      `🧮 Reçu : ${formatFCFA(received)}\n` +
      `${match ? '✅ Caisse OK' : `⚠️ Écart : ${formatFCFA(diff)}`}\n` +
      `${stockDeducted ? '📦 Stock déduit\n' : ''}` +
      (comment ? `📝 ${comment}\n` : '') +
      (signature ? `✍️ ${signature}\n` : '') +
      `\nOuvrir dans l'app : Rapport du jour → ${date}\n— Stock Manager AI`
    );
  }

  function buildReportHtml(): string {
    const est = activeEstablishment?.name || 'Maquis';
    const rows = soldLines
      .map(
        (l, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(l.name)}</td><td class="n">${l.qty}</td><td class="n">${l.price.toLocaleString('fr-FR')}</td><td class="n">${(l.qty * l.price).toLocaleString('fr-FR')}</td></tr>`
      )
      .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rapport ${date}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111;max-width:720px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
  th{background:#f5f5f5}
  .n{text-align:right}
  .box{border:1px solid #ddd;border-radius:8px;padding:12px;margin-top:12px}
  .ok{color:#059669;font-weight:600}.bad{color:#dc2626;font-weight:600}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#fef3c7;font-size:12px}
  @media print{button,.no-print{display:none}}
</style></head><body>
<h1>Rapport du jour — ${escapeHtml(est)}</h1>
<p class="muted">Date du point : <strong>${date}</strong> · Généré le ${new Date().toLocaleString('fr-FR')}</p>
<p class="badge">${bizType}</p>
<table><thead><tr><th>#</th><th>Boisson</th><th class="n">Qté</th><th class="n">Prix unit.</th><th class="n">Total</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">Aucune vente saisie</td></tr>'}</tbody>
<tfoot><tr><td colspan="4"><strong>Total théorique</strong></td><td class="n"><strong>${theoretical.toLocaleString('fr-FR')} FCFA</strong></td></tr></tfoot>
</table>
<div class="box">
  <p><strong>Espèces comptées :</strong> ${cash.toLocaleString('fr-FR')} FCFA</p>
  <p><strong>Mobile Money reçu :</strong> ${mobile.toLocaleString('fr-FR')} FCFA</p>
  <p><strong>Total reçu :</strong> ${received.toLocaleString('fr-FR')} FCFA</p>
  <p>Contrôle caisse :
    <span class="${match ? 'ok' : 'bad'}">${match ? 'OK — coïncide' : 'Écart ' + diff.toLocaleString('fr-FR') + ' FCFA'}</span>
  </p>
  ${stockDeducted ? '<p>📦 Stock inventaire mis à jour</p>' : ''}
  ${comment ? `<p><strong>Commentaire :</strong> ${escapeHtml(comment)}</p>` : ''}
  ${signature ? `<p><strong>Signature :</strong> ${escapeHtml(signature)}</p>` : ''}
</div>
<p class="muted">Trace app : Outils → Rapport du jour → date ${date}</p>
<button class="no-print" onclick="window.print()">Enregistrer en PDF / Imprimer</button>
</body></html>`;
  }

  function openPrintPdf() {
    const html = buildReportHtml();
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('Autorisez les pop-ups pour le PDF.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* */
      }
    }, 400);
  }

  function downloadReportFile() {
    const html = buildReportHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${date}-${(activeEstablishment?.name || 'maquis').replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function sendReport() {
    if (!estId) return;
    if (soldLines.length === 0) {
      alert('Indiquez au moins une boisson vendue.');
      setStep(1);
      return;
    }
    setSaving(true);

    // 1) Déduction stock
    const deducted = await deductStock();
    const payload = buildPayload({
      stock_deducted: deducted || stockDeducted,
      sent_at: new Date().toISOString(),
    });

    // 2) Sauvegarde rapport
    const id = await saveReport(true, payload);
    if (!id) {
      setSaving(false);
      alert('Impossible d’enregistrer le rapport. Réessayez.');
      return;
    }

    // 3) Notification propriétaire (app + canaux)
    try {
      await notifyOwnerOnReport({
        establishmentId: estId,
        senderName: member?.full_name || member?.email || 'Équipe',
        senderRole: member?.role ? ROLE_LABELS[member.role] || member.role : 'staff',
        reportSummary: reportText(),
        reportDate: date,
      });
      openOwnerChannelsAfterReport();
    } catch {
      // fallback notifications basiques
      try {
        const { data: managers } = await supabase
          .from('members')
          .select('user_id')
          .eq('establishment_id', estId)
          .eq('status', 'active')
          .in('role', ['owner', 'admin', 'super_admin']);
        if (managers?.length) {
          await supabase.from('notifications').insert(
            managers.map((m) => ({
              user_id: m.user_id,
              title: `Rapport du jour — ${date}`,
              message: `${soldLines.length} boisson(s) · ${formatFCFA(theoretical)} · ${match ? 'Caisse OK' : 'Écart'}`,
              read: false,
              type: 'daily_report',
              link: `/daily-report?date=${date}`,
              action_label: 'Ouvrir le rapport',
            }))
          );
        }
      } catch {
        /* */
      }
    }

    setSent(true);
    setStockDeducted(deducted || stockDeducted);
    setSaving(false);
    await loadHistory();

    // 4) Fichier rapport + PDF
    downloadReportFile();
    openPrintPdf();

    // 5) WhatsApp
    const msg =
      reportText() +
      '\n\n📎 Un fichier rapport a été téléchargé sur cet appareil — joignez-le dans WhatsApp (PDF via Imprimer → Enregistrer en PDF).';
    const link = buildWhatsAppLink(ownerPhone, msg);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        alert(
          'Rapport enregistré + stock mis à jour. Message copié. Collez-le dans WhatsApp. (Téléphone établissement dans Paramètres pour envoi direct.)'
        );
      } catch {
        alert('Rapport enregistré. Stock mis à jour.');
      }
    }
  }

  async function saveOnly() {
    setSaving(true);
    await saveReport(false);
    setSaving(false);
    await loadHistory();
    alert('Brouillon enregistré.');
  }

  function openHistoryRow(h: HistoryRow) {
    setDate(h.date);
    setShowHistory(false);
    try {
      window.history.replaceState({}, '', `/daily-report?date=${h.date}`);
    } catch {
      /* */
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<ClipboardCheck size={40} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour le rapport du jour."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
            <ClipboardCheck className="text-amber-400" size={26} /> Rapport du jour
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            Point boissons → caisse → stock → envoi propriétaire
          </p>
          <p className="text-stone-500 text-xs mt-1">{activeEstablishment?.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-xs py-2 flex items-center gap-1"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History size={14} /> Historique
          </button>
          <Calendar size={16} className="text-stone-500" />
          <input
            type="date"
            className="input-field py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {showHistory && (
        <div className="card space-y-2 max-h-64 overflow-y-auto">
          <p className="text-sm font-medium text-stone-200">Rapports enregistrés</p>
          {history.length === 0 ? (
            <p className="text-xs text-stone-500">Aucun rapport pour le moment.</p>
          ) : (
            history.map((h) => {
              let preview = '';
              try {
                if (h.notes?.startsWith('{')) {
                  const p = JSON.parse(h.notes) as SavedPayload;
                  preview = `${(p.items || []).filter((i) => i.qty > 0).length} boisson(s)${p.stock_deducted ? ' · stock OK' : ''}`;
                }
              } catch {
                /* */
              }
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openHistoryRow(h)}
                  className="w-full text-left flex items-center gap-2 p-2 rounded-xl hover:bg-stone-800 border border-stone-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-100 font-medium">{h.date}</p>
                    <p className="text-xs text-stone-500 truncate">
                      {formatFCFA(Number(h.total_sales) || 0)}
                      {preview ? ` · ${preview}` : ''}
                      {h.signature ? ` · ${h.signature}` : ''}
                    </p>
                  </div>
                  {h.sent_at ? (
                    <Badge color="success">Envoyé</Badge>
                  ) : (
                    <Badge color="warning">Brouillon</Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="flex gap-2 text-xs">
        {[
          { n: 1 as const, label: 'Boissons vendues' },
          { n: 2 as const, label: 'Caisse / Mobile Money' },
          { n: 3 as const, label: 'Envoi' },
        ].map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`flex-1 rounded-xl px-2 py-2 border ${
              step === s.n
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                : 'border-stone-800 text-stone-500'
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {sent && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 space-y-1">
          <p>Rapport envoyé pour le {date}.</p>
          <p className="text-xs text-emerald-400/80">
            {stockDeducted ? 'Stock déduit de l’inventaire. ' : ''}
            Le propriétaire peut rouvrir ce rapport via Historique ou la notification.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-stone-400">
            Indiquez le <strong className="text-stone-200">nombre vendu</strong> pour chaque boisson.
          </p>
          {products.length === 0 ? (
            <EmptyState
              icon={<Beer size={40} />}
              title="Aucune boisson"
              message="Ajoutez des produits dans Inventaire d’abord."
            />
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {products.map((p) => (
                <div key={p.id} className="card flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      {formatFCFA(Number(p.price) || 0)}
                      {p.unit ? ` · ${p.unit}` : ''} · stock {Math.floor(Number(p.stock) || 0)}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="input-field w-24 text-center font-mono"
                    placeholder="0"
                    value={qtyMap[p.id] ?? ''}
                    onChange={(e) => setQtyMap((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="card flex items-center justify-between">
            <span className="text-stone-400 text-sm">Total théorique</span>
            <span className="text-xl font-bold text-amber-300">{formatFCFA(theoretical)}</span>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              if (soldLines.length === 0) {
                alert('Saisissez au moins une quantité vendue.');
                return;
              }
              setStep(2);
            }}
          >
            Continuer → Caisse
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card space-y-2">
            <p className="text-sm text-stone-400">Récap ventes</p>
            {soldLines.map((l) => (
              <div key={l.product_id} className="flex justify-between text-sm">
                <span className="text-stone-300">
                  {l.name} × {l.qty}
                </span>
                <span className="font-mono text-stone-200">{formatFCFA(l.qty * l.price)}</span>
              </div>
            ))}
            <div className="border-t border-stone-800 pt-2 flex justify-between">
              <span className="text-stone-400">À encaisser</span>
              <span className="font-bold text-amber-300">{formatFCFA(theoretical)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card space-y-1">
              <label className="text-xs text-stone-500 flex items-center gap-1">
                <DollarSign size={12} /> Argent liquide compté
              </label>
              <input
                type="number"
                min={0}
                className="input-field font-bold text-lg"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="card space-y-1">
              <label className="text-xs text-stone-500 flex items-center gap-1">
                <Smartphone size={12} /> Mobile Money reçu
              </label>
              <input
                type="number"
                min={0}
                className="input-field font-bold text-lg"
                value={mobileCounted}
                onChange={(e) => setMobileCounted(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div
            className={`card border ${
              match ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'
            }`}
          >
            <div className="flex items-start gap-2">
              {match ? (
                <CheckCircle2 className="text-emerald-400 shrink-0" size={22} />
              ) : (
                <AlertTriangle className="text-amber-400 shrink-0" size={22} />
              )}
              <div>
                <p className="font-medium text-stone-100">
                  {match ? 'Les montants coïncident' : 'Écart détecté'}
                </p>
                <p className="text-sm text-stone-400 mt-1">
                  Théorique {formatFCFA(theoretical)} · Reçu {formatFCFA(received)}
                  {!match && (
                    <>
                      {' '}
                      · Différence <strong className="text-amber-200">{formatFCFA(diff)}</strong>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              ← Boissons
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setStep(3)}>
              Continuer → Envoi
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Total théorique</span>
              <span className="font-mono text-amber-300">{formatFCFA(theoretical)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Liquide + Mobile Money</span>
              <span className="font-mono text-stone-200">{formatFCFA(received)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Contrôle caisse</span>
              <span className={match ? 'text-emerald-400' : 'text-amber-400'}>
                {match ? 'OK' : `Écart ${formatFCFA(diff)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-stone-400 flex items-center gap-1">
                <PackageMinus size={14} /> Stock inventaire
              </span>
              <span className="text-stone-300 text-xs">
                {stockDeducted ? 'Déjà déduit' : 'Sera déduit à l’envoi'}
              </span>
            </div>
          </div>

          <div>
            <label className="label">Commentaire</label>
            <textarea
              className="input-field min-h-[100px]"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Observations, écarts, incidents du jour…"
            />
          </div>
          <div>
            <label className="label">Signature / responsable</label>
            <input
              className="input-field"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Nom du gérant"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              disabled={saving}
              onClick={() => void saveOnly()}
            >
              <Save size={16} /> Enregistrer brouillon
            </button>
            <button
              type="button"
              className="btn-primary flex items-center justify-center gap-2"
              disabled={saving}
              onClick={() => void sendReport()}
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Envoyer le rapport
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={openPrintPdf}
            >
              <FileText size={16} /> PDF / Imprimer
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center justify-center gap-2"
              onClick={downloadReportFile}
            >
              <FileText size={16} /> Télécharger fichier rapport
            </button>
            {ownerPhone && (
              <a
                href={buildWhatsAppLink(ownerPhone, reportText())}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center justify-center gap-2 text-emerald-300 border-emerald-700/40"
              >
                <MessageCircle size={16} /> WhatsApp propriétaire
              </a>
            )}
            <button type="button" className="btn-ghost text-stone-500" onClick={() => setStep(2)}>
              ← Retour caisse
            </button>
          </div>

          <p className="text-xs text-stone-500">
            Envoi = sauvegarde datée + notification propriétaire + déduction stock + fichier + PDF + WhatsApp.
            WhatsApp ne permet pas de joindre un PDF automatiquement depuis le navigateur : le fichier est
            téléchargé pour que vous le joigniez, et le message texte est prérempli.
          </p>
        </div>
      )}

      <button
        type="button"
        className="text-xs text-stone-500 flex items-center gap-1 hover:text-stone-300"
        onClick={() => void load()}
      >
        <RefreshCw size={12} /> Recharger
      </button>
    </div>
  );
}
