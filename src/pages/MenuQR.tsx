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
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [showStock, setShowStock] = useState(true);
  const [profileUrl, setProfileUrl] = useState('');
  const [evTitle, setEvTitle] = useState('');
  const [evWhen, setEvWhen] = useState('');
  const [evVenue, setEvVenue] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evSaving, setEvSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

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
      .select('public_menu, description, cover_url, public_show_stock, name, slug')
      .eq('id', estId)
      .maybeSingle();
    if (err) setError(err.message);
    const row = data as any;
    setEnabled(Boolean(row?.public_menu));
    setDescription(row?.description || '');
    setCoverUrl(row?.cover_url || '');
    setShowStock(row?.public_show_stock !== false);
    if (typeof window !== 'undefined' && row) {
      const { slugify } = await import('@/lib/publicEstablishment');
      const slug = row.slug || slugify(String(row.name || 'etablissement'), estId);
      setProfileUrl(`${window.location.origin}/e/${slug}`);
    }
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
              {profileUrl && (
                <p className="text-xs text-emerald-400/90 break-all px-2">Fiche publique : {profileUrl}</p>
              )}
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
                {profileUrl && (
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-600 px-3 py-2 text-sm text-stone-200"
                  >
                    Voir la fiche
                  </a>
                )}
              </div>
              <p className="text-[11px] text-stone-500">
                Imprimez le QR et placez-le sur les tables ou à l’entrée.
              </p>
            </div>
          )}

          {canEdit && (
            <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3">
              <p className="font-medium text-stone-100">Vitrine publique</p>
              <textarea
                className="input-field min-h-[80px] text-sm"
                placeholder="Description visible par les visiteurs"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <input
                className="input-field text-sm"
                placeholder="URL photo de couverture (optionnel)"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => setShowStock(e.target.checked)}
                />
                Afficher les quantités disponibles sur le menu public
              </label>
              <button
                type="button"
                className="btn-primary w-full text-sm"
                disabled={saving}
                onClick={async () => {
                  if (!estId) return;
                  setSaving(true);
                  setError(null);
                  setOkMsg(null);
                  const { slugify } = await import('@/lib/publicEstablishment');
                  const name = activeEstablishment?.name || 'etablissement';
                  const slug = slugify(name, estId);
                  const { error: err } = await supabase
                    .from('establishments')
                    .update({
                      description: description.trim() || null,
                      cover_url: coverUrl.trim() || null,
                      public_show_stock: showStock,
                      slug,
                    })
                    .eq('id', estId);
                  if (err) {
                    setError(
                      err.message.includes('description') || err.message.includes('slug')
                        ? 'Colonnes vitrine absentes — appliquez la migration public_platform sur Supabase.'
                        : err.message
                    );
                  } else {
                    setOkMsg('Vitrine enregistrée');
                    setProfileUrl(`${window.location.origin}/e/${slug}`);
                  }
                  setSaving(false);
                }}
              >
                Enregistrer la vitrine
              </button>
              {okMsg && <p className="text-xs text-emerald-400">{okMsg}</p>}
            </div>
          )}

          {canEdit && (
            <div className="mt-5 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3">
              <p className="font-medium text-stone-100">Publier un événement</p>
              <input className="input-field text-sm" placeholder="Titre (ex. Afrobeat Night)" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
              <input className="input-field text-sm" type="datetime-local" value={evWhen} onChange={(e) => setEvWhen(e.target.value)} />
              <input className="input-field text-sm" placeholder="Lieu" value={evVenue} onChange={(e) => setEvVenue(e.target.value)} />
              <textarea className="input-field text-sm min-h-[60px]" placeholder="Description" value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
              <button
                type="button"
                className="btn-secondary w-full text-sm"
                disabled={evSaving || !evTitle.trim() || !evWhen}
                onClick={async () => {
                  if (!estId) return;
                  setEvSaving(true);
                  setError(null);
                  const { error: err } = await supabase.from('public_events').insert({
                    establishment_id: estId,
                    title: evTitle.trim(),
                    description: evDesc.trim() || null,
                    venue: evVenue.trim() || null,
                    starts_at: new Date(evWhen).toISOString(),
                    is_published: true,
                    created_by: member?.user_id || null,
                  });
                  if (err) {
                    setError(
                      err.message.includes('public_events')
                        ? 'Table public_events absente — appliquez la migration sur Supabase.'
                        : err.message
                    );
                  } else {
                    setOkMsg('Événement publié');
                    setEvTitle('');
                    setEvWhen('');
                    setEvVenue('');
                    setEvDesc('');
                  }
                  setEvSaving(false);
                }}
              >
                {evSaving ? 'Publication…' : 'Publier l’événement'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
