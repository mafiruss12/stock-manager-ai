import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Copy, Check, ExternalLink, Printer, Loader2, ToggleLeft, ToggleRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePlanAccess } from '@/lib/usePlanAccess';
import { useAuth } from '@/lib/auth';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';
import { EmptyState } from '@/components/ui';
import {
  parseQrConfig,
  qrImageUrl,
  orderUrl,
  type QrConfig,
} from '@/lib/qrBranding';

/**
 * Page QR Code — commande à table uniquement.
 * Vitrine publique / événements retirés.
 */
export default function MenuQR() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const { allow, plan } = usePlanAccess();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const canEdit = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || ''),
  );

  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [qrColor, setQrColor] = useState('1c1917');
  const [qrBg, setQrBg] = useState('ffffff');
  const [qrTitle, setQrTitle] = useState('');
  const [qrWelcome, setQrWelcome] = useState('Bienvenue — passez votre commande');
  const [qrKiosk, setQrKiosk] = useState(true);
  const [slug, setSlug] = useState('');
  const [showStock, setShowStock] = useState(true);

  const estKey = slug || estId || '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrCfgLive: QrConfig = {
    color: qrColor,
    bg: qrBg,
    title: qrTitle,
    welcome: qrWelcome,
    kiosk_default: qrKiosk,
  };
  const sampleTableUrl =
    estKey && origin
      ? orderUrl({ origin, estKey, table: 1, kiosk: qrKiosk })
      : '';
  const sampleTableQr = sampleTableUrl ? qrImageUrl(sampleTableUrl, qrCfgLive, 240) : '';
  const baseOrderUrl =
    estKey && origin ? orderUrl({ origin, estKey, kiosk: qrKiosk }) : '';

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('establishments')
      .select('name, slug, qr_config, public_show_stock, public_menu')
      .eq('id', estId)
      .maybeSingle();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const row = data as Record<string, unknown> | null;
    if (row) {
      setSlug(String(row.slug || ''));
      setShowStock(row.public_show_stock !== false);
      // Commande QR active par défaut si colonne absente
      setEnabled(row.public_menu !== false);
      const cfg = parseQrConfig(row.qr_config);
      setQrColor(cfg.color);
      setQrBg(cfg.bg);
      setQrTitle(cfg.title);
      setQrWelcome(cfg.welcome);
      setQrKiosk(cfg.kiosk_default);
    }
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleEnabled() {
    if (!estId || !canEdit) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('establishments')
      .update({ public_menu: next })
      .eq('id', estId);
    setSaving(false);
    if (err) {
      setError(
        err.message.includes('public_menu')
          ? 'Impossible de mettre à jour — vérifiez la base.'
          : err.message,
      );
      return;
    }
    setEnabled(next);
    setOkMsg(next ? 'Commande QR activée' : 'Commande QR désactivée');
    setTimeout(() => setOkMsg(null), 2500);
  }

  async function saveQrConfig() {
    if (!estId || !canEdit) return;
    setSaving(true);
    setError(null);
    try {
      const { slugify } = await import('@/lib/publicEstablishment');
      const finalSlug =
        (slug || '').trim() ||
        slugify(String(activeEstablishment?.name || 'etablissement'), estId);
      const payload = {
        slug: finalSlug,
        public_show_stock: showStock,
        qr_config: {
          color: qrColor,
          bg: qrBg,
          title: qrTitle,
          welcome: qrWelcome,
          kiosk_default: qrKiosk,
          show_name: true,
        },
      };
      const { error: err } = await supabase
        .from('establishments')
        .update(payload)
        .eq('id', estId);
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      setSlug(finalSlug);
      setOkMsg('QR Code enregistré');
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: unknown) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Erreur enregistrement');
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie impossible');
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<QrCode size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour configurer les QR tables."
      />
    );
  }

  if (!allow('qrOrdering')) {
    return (
      <div className="card p-6 space-y-3 max-w-lg mx-auto">
        <h1 className="text-lg font-semibold text-stone-100">QR Code</h1>
        <p className="text-sm text-stone-400">
          Réservé au plan <strong className="text-amber-300">Pro</strong> (plan
          effectif : {plan.label}).
        </p>
        <p className="text-xs text-stone-500">
          Passez en Pro pour générer les QR de tables et recevoir les commandes.
        </p>
        <Link to="/subscription" className="btn-primary inline-flex justify-center">
          Voir les forfaits
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 mb-4"
      >
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div className="mb-5">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: theme.primary }}
        >
          Tables & commandes
        </p>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5 flex items-center gap-2">
          <QrCode size={22} style={{ color: theme.primary }} />
          QR Code
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
          Les clients scannent le QR sur la table pour commander — sans
          installer d&apos;application.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {okMsg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-stone-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Activation */}
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                Commande via QR tables
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {enabled
                  ? 'Les scans ouvrent la page commande'
                  : 'Commande QR désactivée pour cet établissement'}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleEnabled()}
                className="shrink-0 text-amber-600 dark:text-amber-400"
                aria-label={enabled ? 'Désactiver' : 'Activer'}
              >
                {enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
              </button>
            )}
          </div>

          {/* Aperçu QR table */}
          <div className="rounded-2xl border border-emerald-700/30 bg-emerald-50/80 dark:bg-emerald-950/20 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-400">
              Aperçu — Table 1
            </p>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {activeEstablishment?.name || 'Établissement'}
            </p>
            {sampleTableQr && (
              <div className="flex justify-center">
                <div className="rounded-2xl bg-white p-3 border border-emerald-700/20 shadow-sm">
                  <img
                    src={sampleTableQr}
                    alt="QR table exemple"
                    className="w-48 h-48"
                    width={240}
                    height={240}
                  />
                </div>
              </div>
            )}
            <div className="rounded-xl bg-emerald-800 text-white text-xs font-bold py-2.5 text-center">
              SCANNEZ CE QR CODE
            </div>
            <p className="text-[11px] text-center text-stone-600 dark:text-stone-400">
              pour passer commande · sans télécharger d&apos;application
            </p>
          </div>

          {/* Liens */}
          {baseOrderUrl && (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 p-4 space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase">
                Lien commande
              </p>
              <p className="text-xs break-all font-mono text-stone-700 dark:text-stone-300">
                {sampleTableUrl || baseOrderUrl}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs flex items-center gap-1"
                  onClick={() => void copyLink(sampleTableUrl || baseOrderUrl)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
                <a
                  href={sampleTableUrl || baseOrderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <ExternalLink size={14} /> Tester
                </a>
              </div>
            </div>
          )}

          {/* Config */}
          {canEdit && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <QrCode size={18} className="text-amber-500" />
                Personnaliser le QR
              </h3>
              <label className="block text-xs text-stone-500">
                Identifiant (slug) — dans l&apos;URL de commande
                <input
                  className="input-field mt-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ex. gbaissai-chez-rco"
                />
              </label>
              <label className="block text-xs text-stone-500">
                Titre (optionnel)
                <input
                  className="input-field mt-1"
                  value={qrTitle}
                  onChange={(e) => setQrTitle(e.target.value)}
                  maxLength={40}
                />
              </label>
              <label className="block text-xs text-stone-500">
                Message d&apos;accueil client
                <input
                  className="input-field mt-1"
                  value={qrWelcome}
                  onChange={(e) => setQrWelcome(e.target.value)}
                  maxLength={80}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-stone-500">
                  Couleur QR
                  <input
                    type="color"
                    className="mt-1 h-10 w-full rounded-lg border border-stone-300 cursor-pointer"
                    value={`#${qrColor}`}
                    onChange={(e) => setQrColor(e.target.value.replace('#', ''))}
                  />
                </label>
                <label className="block text-xs text-stone-500">
                  Fond QR
                  <input
                    type="color"
                    className="mt-1 h-10 w-full rounded-lg border border-stone-300 cursor-pointer"
                    value={`#${qrBg}`}
                    onChange={(e) => setQrBg(e.target.value.replace('#', ''))}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={qrKiosk}
                  onChange={(e) => setQrKiosk(e.target.checked)}
                />
                Mode kiosque (idéal tablette table)
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => setShowStock(e.target.checked)}
                />
                Afficher les quantités sur la page commande
              </label>
              <button
                type="button"
                className="btn-primary w-full min-h-[44px]"
                disabled={saving}
                onClick={() => void saveQrConfig()}
              >
                {saving ? '…' : 'Enregistrer le QR Code'}
              </button>
            </div>
          )}

          <Link
            to="/print-qr"
            className="btn-secondary w-full min-h-[48px] flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Imprimer les QR tables (affiche pro)
          </Link>
        </div>
      )}
    </div>
  );
}
