import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Calendar, DollarSign, Smartphone, Loader2, Send, Save,
  Beer, CheckCircle2, AlertTriangle, MessageCircle, FileText, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useEstId } from '@/lib/useEstId';
import type { Product } from '@/lib/types';
import { EmptyState } from '@/components/ui';
import { formatFCFA } from '@/lib/format';
import { buildWhatsAppLink, normalizeBusinessType } from '@/lib/businessTypes';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

type Line = { product_id: string; name: string; price: number; qty: number };

type SavedPayload = {
  items: Line[];
  cash_counted: number;
  mobile_counted: number;
  theoretical: number;
  match: boolean;
  comment: string;
  signature: string;
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
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const lines: Line[] = useMemo(() => {
    return products.map((p) => ({
      product_id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
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
  const match = Math.abs(diff) < 1; // tolérance 1 FCFA

  async function load() {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: prods }, { data: existing }, estRes] = await Promise.all([
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
      supabase.from('establishments').select('phone, name').eq('id', estId).maybeSingle(),
    ]);

    const list = (prods ?? []) as Product[];
    setProducts(list);
    setOwnerPhone(estRes.data?.phone ?? null);

    if (existing) {
      setReportId(existing.id);
      setSent(Boolean((existing as any).sent_at));
      setSignature(existing.signature || member?.full_name || '');
      // Restaurer lignes depuis notes JSON
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
      setQtyMap({});
      setCashCounted('');
      setMobileCounted('');
      setComment('');
      setStep(1);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estId, date]);

  function buildPayload(): SavedPayload {
    return {
      items: soldLines,
      cash_counted: cash,
      mobile_counted: mobile,
      theoretical,
      match,
      comment,
      signature,
    };
  }

  async function saveReport(markSent: boolean) {
    if (!estId) return null;
    const payload = buildPayload();
    const row = {
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
      ...(markSent ? { sent_at: new Date().toISOString() } : {}),
    };

    if (reportId) {
      const { error } = await supabase.from('daily_reports').update(row).eq('id', reportId);
      if (error && String(error.message).includes('sent_at')) {
        const { sent_at: _s, ...rest } = row as any;
        await supabase.from('daily_reports').update(rest).eq('id', reportId);
      }
      return reportId;
    }
    const { data, error } = await supabase.from('daily_reports').insert(row).select('id').maybeSingle();
    if (error) {
      // retry without optional cols
      const { sent_at: _s, ...rest } = row as any;
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
      `💵 Espèces comptées : ${formatFCFA(cash)}\n` +
      `📱 Mobile Money : ${formatFCFA(mobile)}\n` +
      `🧮 Reçu total : ${formatFCFA(received)}\n` +
      `${match ? '✅ Caisse OK (coïncide)' : `⚠️ Écart : ${formatFCFA(diff)}`}\n\n` +
      (comment ? `📝 Commentaire : ${comment}\n` : '') +
      (signature ? `✍️ ${signature}\n` : '') +
      `\n— Stock Manager AI`
    );
  }

  function openPrintPdf() {
    const est = activeEstablishment?.name || 'Maquis';
    const rows = soldLines
      .map(
        (l, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(l.name)}</td><td class="n">${l.qty}</td><td class="n">${l.price.toLocaleString('fr-FR')}</td><td class="n">${(l.qty * l.price).toLocaleString('fr-FR')}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Rapport ${date}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:24px;color:#111}
  h1{font-size:20px;margin:0 0 4px}
  .muted{color:#666;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
  th{background:#f5f5f5}
  .n{text-align:right}
  .box{border:1px solid #ddd;border-radius:8px;padding:12px;margin-top:12px}
  .ok{color:#059669}.bad{color:#dc2626}
  @media print{button{display:none}}
</style></head><body>
<h1>Rapport du jour — ${escapeHtml(est)}</h1>
<p class="muted">Date : ${date} · Généré le ${new Date().toLocaleString('fr-FR')}</p>
<table><thead><tr><th>#</th><th>Boisson</th><th class="n">Qté</th><th class="n">Prix</th><th class="n">Total</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">Aucune vente saisie</td></tr>'}</tbody></table>
<div class="box">
  <p><strong>Total théorique :</strong> ${theoretical.toLocaleString('fr-FR')} FCFA</p>
  <p>Espèces : ${cash.toLocaleString('fr-FR')} FCFA · Mobile Money : ${mobile.toLocaleString('fr-FR')} FCFA</p>
  <p>Reçu : ${received.toLocaleString('fr-FR')} FCFA —
    <span class="${match ? 'ok' : 'bad'}">${match ? 'Caisse OK' : 'Écart ' + diff.toLocaleString('fr-FR') + ' FCFA'}</span>
  </p>
  ${comment ? `<p>Commentaire : ${escapeHtml(comment)}</p>` : ''}
  ${signature ? `<p>Signature : ${escapeHtml(signature)}</p>` : ''}
</div>
<p class="muted">Ouvrez aussi ce rapport dans l'app → Outils → Rapport du jour (date ${date}).</p>
<button onclick="window.print()">Enregistrer / Imprimer PDF</button>
<script>setTimeout(()=>window.print(),400)</script>
</body></html>`;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('Autorisez les pop-ups pour le PDF.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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
    const id = await saveReport(true);
    if (!id) {
      setSaving(false);
      alert('Impossible d’enregistrer le rapport. Réessayez.');
      return;
    }

    // Notifications propriétaires / admins
    try {
      const { data: managers } = await supabase
        .from('members')
        .select('user_id, role')
        .eq('establishment_id', estId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'super_admin']);
      if (managers?.length) {
        await supabase.from('notifications').insert(
          managers.map((m) => ({
            user_id: m.user_id,
            title: `Rapport du jour — ${date}`,
            message: `${soldLines.length} boisson(s) · ${formatFCFA(theoretical)} · ${match ? 'Caisse OK' : 'Écart ' + formatFCFA(diff)}`,
            read: false,
            type: 'daily_report',
            link: `/daily-report?date=${date}`,
            action_label: 'Ouvrir le rapport',
          }))
        );
      }
    } catch {
      /* ignore */
    }

    setSent(true);
    setSaving(false);

    // PDF local (MVP facture du jour)
    openPrintPdf();

    // WhatsApp propriétaire
    const msg = reportText();
    const link = buildWhatsAppLink(ownerPhone, msg);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      // Copier le message si pas de téléphone établissement
      try {
        await navigator.clipboard.writeText(msg);
        alert('Rapport enregistré. Message copié — collez-le dans WhatsApp au propriétaire. Renseignez le téléphone de l’établissement dans Paramètres pour un envoi direct.');
      } catch {
        alert('Rapport enregistré. Ouvrez WhatsApp et envoyez le point au propriétaire.');
      }
    }
  }

  async function saveOnly() {
    setSaving(true);
    await saveReport(false);
    setSaving(false);
    alert('Brouillon enregistré.');
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
            Point boissons → caisse → envoi au propriétaire
          </p>
          <p className="text-stone-500 text-xs mt-1">{activeEstablishment?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-stone-500" />
          <input
            type="date"
            className="input-field py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Étapes */}
      <div className="flex gap-2 text-xs">
        {[
          { n: 1 as const, label: 'Boissons vendues' },
          { n: 2 as const, label: 'Caisse / Mobile Money' },
          { n: 3 as const, label: 'Commentaire & envoi' },
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
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Rapport envoyé pour le {date}. Le propriétaire peut le rouvrir dans l’app (même date).
        </div>
      )}

      {/* Étape 1 — liste boissons */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-stone-400">
            Liste des boissons — indiquez le <strong className="text-stone-200">nombre vendu</strong> pour chacune.
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
                <div
                  key={p.id}
                  className="card flex items-center gap-3 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 truncate">{p.name}</p>
                    <p className="text-xs text-stone-500">
                      {p.category || 'Boisson'} · {formatFCFA(Number(p.price) || 0)}
                      {p.unit ? ` · ${p.unit}` : ''}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="input-field w-24 text-center font-mono"
                    placeholder="0"
                    value={qtyMap[p.id] ?? ''}
                    onChange={(e) =>
                      setQtyMap((m) => ({ ...m, [p.id]: e.target.value }))
                    }
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

      {/* Étape 2 — comparaison caisse */}
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
                {!match && (
                  <p className="text-xs text-stone-500 mt-1">
                    Vous pouvez quand même continuer et expliquer l’écart dans le commentaire.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              ← Boissons
            </button>
            <button type="button" className="btn-primary flex-1" onClick={() => setStep(3)}>
              Continuer → Commentaire
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — commentaire & envoi */}
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
              className="btn-secondary flex items-center justify-center gap-2 text-stone-300"
              onClick={openPrintPdf}
            >
              <FileText size={16} /> PDF / facture du jour
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
            À l’envoi : sauvegarde dans l’app (date {date}), notification au propriétaire, PDF imprimable et message WhatsApp.
            {bizType === 'maquis' ? '' : ' (Fonctionne aussi pour les autres établissements avec produits.)'}
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
