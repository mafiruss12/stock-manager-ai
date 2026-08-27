import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Copy, Check, ExternalLink, Loader2, ToggleLeft, ToggleRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  normalizeBusinessType,
  BUSINESS_THEMES,
} from '@/lib/businessTypes';
import { EmptyState } from '@/components/ui';

export default function MenuQR() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  const canEdit = ['super_admin', 'admin', 'owner', 'manager'].includes(
    String(effectiveRole || member?.role || '')
  );

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const menuUrl =
    typeof window !== 'undefined' && estId
      ? `${window.location.origin}/m/${estId}`
      : estId
        ? `/m/${estId}`
        : '';

  const qrSrc = menuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(menuUrl)}`
    : '';

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('establishments')
      .select('public_menu')
      .eq('id', estId)
      .maybeSingle();
    if (err) setError(err.message);
    setEnabled(Boolean((data as { public_menu?: boolean } | null)?.public_menu));
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (!estId || !canEdit || saving) return;
    setSaving(true);
    setError(null);
    const next = !enabled;
    const { error: err } = await supabase
      .from('establishments')
      .update({ public_menu: next })
      .eq('id', estId);
    if (err) {
      setError(
        err.message.includes('public_menu')
          ? 'Colonne public_menu absente — appliquez la migration Phase 2.'
          : err.message
      );
    } else {
      setEnabled(next);
    }
    setSaving(false);
  }

  async function copyLink() {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier le lien');
    }
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<QrCode size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement."
      />
    );
  }

  return (
    <div className="max-w-md mx-auto pb-16">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-200 mb-4"
      >
        <ArrowLeft size={16} /> Accueil
      </Link>

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.primary }}>
          Menu en ligne
        </p>
        <h1 className="text-2xl font-bold text-stone-100 mt-0.5 flex items-center gap-2">
          <QrCode size={22} style={{ color: theme.primary }} />
          QR Code & Menu public
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Les clients scannent le QR pour voir vos boissons et prix sans installer d’app.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-stone-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-stone-100">Menu public</p>
              <p className="text-xs text-stone-500">
                {enabled ? 'Visible par les clients (lien + QR)' : 'Désactivé — activez pour partager'}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => void toggle()}
                disabled={saving}
                className="p-1"
                title={enabled ? 'Désactiver' : 'Activer'}
              >
                {saving ? (
                  <Loader2 className="animate-spin text-stone-400" size={28} />
                ) : enabled ? (
                  <ToggleRight size={32} className="text-emerald-400" />
                ) : (
                  <ToggleLeft size={32} className="text-stone-500" />
                )}
              </button>
            )}
          </div>

          {enabled && (
            <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5 text-center space-y-4">
              {qrSrc && (
                <img
                  src={qrSrc}
                  alt="QR code menu"
                  className="mx-auto w-[220px] h-[220px] rounded-xl bg-white p-2"
                />
              )}
              <p className="text-xs text-stone-500 break-all px-2">{menuUrl}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-stone-200 hover:bg-stone-700"
                >
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  {copied ? 'Copié' : 'Copier le lien'}
                </button>
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-stone-950"
                  style={{ background: theme.primary }}
                >
                  <ExternalLink size={16} /> Ouvrir le menu
                </a>
              </div>
              <p className="text-[11px] text-stone-500">
                Imprimez le QR et placez-le sur les tables ou à l’entrée.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
