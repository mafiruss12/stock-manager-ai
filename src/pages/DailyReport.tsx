import { useEffect, useState } from 'react';
import { ClipboardCheck, Lock, Calendar, DollarSign, TrendingDown, Smartphone, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { DailyReport as Report } from '@/lib/types';
import { EmptyState, Badge } from '@/components/ui';
import { notifyOwnerOnReport, openOwnerMail, openOwnerWhatsApp } from '@/lib/notifyOwner';
import { MessageCircle, Mail } from 'lucide-react';

export default function DailyReportPage() {
  const { member } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ app: boolean; mail: boolean; whatsapp: boolean } | null>(null);
  const [form, setForm] = useState({ losses: '', broken: '', notes: '', signature: '' });

  async function loadReport() {
    if (!member?.establishment_id) {
      setLoading(false);
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('establishment_id', member.establishment_id)
      .eq('date', today)
      .maybeSingle();

    if (data) {
      setReport(data as Report);
      setForm({
        losses: String(data.losses),
        broken: String(data.broken),
        notes: data.notes ?? '',
        signature: data.signature ?? '',
      });
    } else {
      const [salesRes, expensesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('total, payment_method')
          .eq('establishment_id', member.establishment_id)
          .gte('created_at', today),
        supabase
          .from('expenses')
          .select('amount, payment_method')
          .eq('establishment_id', member.establishment_id)
          .gte('created_at', today),
      ]);

      const totalSales = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const totalExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const cash = (salesRes.data ?? []).filter((r) => r.payment_method === 'cash').reduce((s, r) => s + Number(r.total), 0);
      const mobileMoney = (salesRes.data ?? [])
        .filter((r) => r.payment_method === 'mobile_money')
        .reduce((s, r) => s + Number(r.total), 0);

      const { data: newReport } = await supabase
        .from('daily_reports')
        .insert({
          establishment_id: member.establishment_id,
          date: today,
          total_sales: totalSales,
          total_expenses: totalExpenses,
          cash,
          mobile_money: mobileMoney,
        })
        .select()
        .maybeSingle();

      if (newReport) setReport(newReport as Report);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  async function save() {
    if (!report) return;
    setSaving(true);
    await supabase
      .from('daily_reports')
      .update({
        losses: Number(form.losses) || 0,
        broken: Number(form.broken) || 0,
        notes: form.notes,
        signature: form.signature,
      })
      .eq('id', report.id);
    await loadReport();
    setSaving(false);
  }

  async function lockReport() {
    if (!member?.establishment_id || !report) return;
    setSaving(true);
    setNotifyResult(null);
    const { error } = await supabase
      .from('daily_reports')
      .update({
        losses: Number(form.losses) || 0,
        broken: Number(form.broken) || 0,
        notes: form.notes || null,
        signature: form.signature,
        locked: true,
        locked_at: new Date().toISOString(),
        locked_by: member.user_id,
      })
      .eq('id', report.id);
    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }
    const profit =
      Number(report.total_sales) -
      Number(report.total_expenses) -
      (Number(form.losses) || 0) -
      (Number(form.broken) || 0);
    const summary = [
      `Ventes: ${Number(report.total_sales).toLocaleString('fr-FR')} FCFA`,
      `Dépenses: ${Number(report.total_expenses).toLocaleString('fr-FR')} FCFA`,
      `Pertes/casse: ${((Number(form.losses)||0)+(Number(form.broken)||0)).toLocaleString('fr-FR')} FCFA`,
      `Bénéfice estimé: ${profit.toLocaleString('fr-FR')} FCFA`,
      form.notes ? `Notes: ${form.notes}` : null,
      form.signature ? `Signé: ${form.signature}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const nr = await notifyOwnerOnReport({
      establishmentId: member.establishment_id,
      senderName: member.full_name || member.email || 'Équipe',
      senderRole: member.role || 'employé',
      reportSummary: summary,
      reportDate: report.date,
    });
    setNotifyResult({ app: nr.app, mail: nr.mail, whatsapp: nr.whatsapp });
    setReport({ ...report, locked: true, losses: Number(form.losses)||0, broken: Number(form.broken)||0, notes: form.notes, signature: form.signature });
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  if (!member?.establishment_id) {
    return <EmptyState icon={<ClipboardCheck size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;
  }

  if (!report) return null;
  const profit = report.total_sales - report.total_expenses - (Number(form.losses) || 0) - (Number(form.broken) || 0);
  const isLocked = report.locked;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Clôture quotidienne</h1>
          <p className="text-stone-400 text-sm flex items-center gap-2">
            <Calendar size={14} /> {new Date(report.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {isLocked ? (
          <Badge color="success"><Lock size={12} className="inline mr-1" /> Verrouillé</Badge>
        ) : (
          <Badge color="warning">En cours</Badge>
        )}
      </div>

      {/* Résumé auto */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={18} className="text-success-400" /><span className="text-sm text-stone-400">Ventes</span></div>
          <p className="text-xl font-bold text-stone-100">{report.total_sales.toLocaleString('fr-FR')}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1"><TrendingDown size={18} className="text-error-400" /><span className="text-sm text-stone-400">Dépenses</span></div>
          <p className="text-xl font-bold text-stone-100">{report.total_expenses.toLocaleString('fr-FR')}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1"><CreditCard size={18} className="text-secondary-400" /><span className="text-sm text-stone-400">Espèces</span></div>
          <p className="text-xl font-bold text-stone-100">{report.cash.toLocaleString('fr-FR')}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1"><Smartphone size={18} className="text-secondary-400" /><span className="text-sm text-stone-400">Mobile Money</span></div>
          <p className="text-xl font-bold text-stone-100">{report.mobile_money.toLocaleString('fr-FR')}</p>
        </div>
      </div>

      {/* Bénéfice */}
      <div className="card mb-6 flex items-center justify-between">
        <span className="text-stone-400">Bénéfice net estimé</span>
        <span className={`text-2xl font-bold font-display ${profit >= 0 ? 'text-success-400' : 'text-error-400'}`}>
          {profit.toLocaleString('fr-FR')} FCFA
        </span>
      </div>

      {/* Formulaire */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-stone-100 mb-4">Détails de la clôture</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Pertes (FCFA)</label>
            <input
              type="number"
              disabled={isLocked}
              value={form.losses}
              onChange={(e) => setForm({ ...form, losses: e.target.value })}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Casse (FCFA)</label>
            <input
              type="number"
              disabled={isLocked}
              value={form.broken}
              onChange={(e) => setForm({ ...form, broken: e.target.value })}
              className="input-field"
              placeholder="0"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="label">Commentaires</label>
          <textarea
            disabled={isLocked}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field min-h-[80px] resize-y"
            placeholder="Observations du jour..."
          />
        </div>
        <div>
          <label className="label">Signature</label>
          <input
            disabled={isLocked}
            value={form.signature}
            onChange={(e) => setForm({ ...form, signature: e.target.value })}
            className="input-field"
            placeholder="Nom du responsable"
          />
        </div>
      </div>

      {/* Actions */}
      {!isLocked && (
        <div className="flex gap-3 flex-wrap">
          <button onClick={save} disabled={saving} className="btn-secondary flex items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Enregistrer
          </button>
          <button onClick={lockReport} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />} Verrouiller & notifier le propriétaire
          </button>
        </div>
      )}
      {notifyResult && (
        <div className="card mt-4 border border-amber-500/30 bg-amber-500/10 space-y-3">
          <p className="text-sm font-semibold text-amber-100">Notification propriétaire</p>
          <p className="text-xs text-stone-300">
            {notifyResult.app ? '✓ Notification in-app envoyée' : '○ In-app (propriétaire non lié)'}
            {' · '}
            {notifyResult.mail ? '✓ E-mail prêt' : '○ E-mail non configuré'}
            {' · '}
            {notifyResult.whatsapp ? '✓ WhatsApp prêt' : '○ WhatsApp non configuré'}
          </p>
          <div className="flex flex-wrap gap-2">
            {notifyResult.mail && (
              <button type="button" onClick={openOwnerMail} className="btn-secondary flex items-center gap-2 text-sm">
                <Mail size={16} /> Envoyer par e-mail
              </button>
            )}
            {notifyResult.whatsapp && (
              <button type="button" onClick={openOwnerWhatsApp} className="btn-primary flex items-center gap-2 text-sm">
                <MessageCircle size={16} /> Envoyer par WhatsApp
              </button>
            )}
          </div>
          <p className="text-[11px] text-stone-500">Configurez e-mail et téléphone du propriétaire dans Paramètres → Établissement.</p>
        </div>
      )}
    </div>
  );
}
