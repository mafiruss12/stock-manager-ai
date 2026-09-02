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
import { DAY_LABELS, type OpeningHours } from '@/lib/publicEstablishment';
import { uploadVitrineImage } from '@/lib/publicMedia';

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
  const [stats, setStats] = useState<{ profile_views: number; menu_views: number; whatsapp_clicks: number; phone_clicks: number } | null>(null);
  const [uploading, setUploading] = useState<'cover' | 'logo' | 'gallery' | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [sponsored, setSponsored] = useState(false);
  const [hours, setHours] = useState<OpeningHours>({
    mon: { open: '09:00', close: '23:00' },
    tue: { open: '09:00', close: '23:00' },
    wed: { open: '09:00', close: '23:00' },
    thu: { open: '09:00', close: '23:00' },
    fri: { open: '09:00', close: '02:00' },
    sat: { open: '10:00', close: '02:00' },
    sun: { open: '10:00', close: '22:00' },
  });

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
      .select('public_menu, description, cover_url, public_show_stock, name, slug, opening_hours, gallery_urls, is_sponsored')
      .eq('id', estId)
      .maybeSingle();
    if (err) setError(err.message);
    const row = data as any;
    setEnabled(Boolean(row?.public_menu));
    setDescription(row?.description || '');
    setCoverUrl(row?.cover_url || '');
    setShowStock(row?.public_show_stock !== false);
    if (row?.opening_hours && typeof row.opening_hours === 'object') {
      setHours((prev) => ({ ...prev, ...(row.opening_hours as OpeningHours) }));
    }
    const g = row?.gallery_urls;
    if (Array.isArray(g)) setGallery(g.filter((x: any) => typeof x === 'string'));
    setSponsored(Boolean(row?.is_sponsored));
    if (typeof window !== 'undefined' && row) {
      const { slugify } = await import('@/lib/publicEstablishment');
      const slug = row.slug || slugify(String(row.name || 'etablissement'), estId);
      setProfileUrl(`${window.location.origin}/e/${slug}`);
    }
    try {
      const { data: st } = await supabase
        .from('public_profile_stats')
        .select('profile_views, menu_views, whatsapp_clicks, phone_clicks')
        .eq('establishment_id', estId)
        .maybeSingle();
      if (st) setStats(st as any);
    } catch { /* */ }
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
          {stats && (
            <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 mb-5 grid grid-cols-2 gap-3 text-center">
              <div><p className="text-lg font-bold text-amber-300">{stats.profile_views}</p><p className="text-[10px] text-stone-500">Vues fiche</p></div>
              <div><p className="text-lg font-bold text-amber-300">{stats.menu_views}</p><p className="text-[10px] text-stone-500">Vues menu</p></div>
              <div><p className="text-lg font-bold text-emerald-300">{stats.whatsapp_clicks}</p><p className="text-[10px] text-stone-500">Clics WhatsApp</p></div>
              <div><p className="text-lg font-bold text-sky-300">{stats.phone_clicks}</p><p className="text-[10px] text-stone-500">Clics téléphone</p></div>
            </div>
          )}
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
              <div className="flex flex-wrap gap-2">
                <label className="flex-1 text-center text-xs font-semibold rounded-xl border border-stone-600 bg-stone-800 px-3 py-2.5 text-stone-200 cursor-pointer">
                  {uploading === 'cover' ? 'Envoi…' : '📷 Upload couverture'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!!uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f || !estId) return;
                      setUploading('cover');
                      setError(null);
                      try {
                        const { url } = await uploadVitrineImage(estId, f, 'cover');
                        setCoverUrl(url);
                        setOkMsg('Couverture prête — enregistrez la vitrine');
                      } catch (ex: any) {
                        setError(ex?.message || 'Upload impossible');
                      }
                      setUploading(null);
                    }}
                  />
                </label>
                <label className="flex-1 text-center text-xs font-semibold rounded-xl border border-stone-600 bg-stone-800 px-3 py-2.5 text-stone-200 cursor-pointer">
                  {uploading === 'logo' ? 'Envoi…' : '🖼️ Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!!uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f || !estId) return;
                      setUploading('logo');
                      setError(null);
                      try {
                        const { url } = await uploadVitrineImage(estId, f, 'logo');
                        const { error: err } = await supabase
                          .from('establishments')
                          .update({ logo_url: url })
                          .eq('id', estId);
                        if (err) setError(err.message);
                        else setOkMsg('Logo mis à jour');
                      } catch (ex: any) {
                        setError(ex?.message || 'Upload logo impossible');
                      }
                      setUploading(null);
                    }}
                  />
                </label>
              </div>
              {coverUrl && (
                <img src={coverUrl} alt="" className="w-full h-28 object-cover rounded-xl border border-stone-700" />
              )}
              <div className="space-y-2">
                <p className="text-xs text-stone-400">Galerie (max 6 photos)</p>
                <div className="flex flex-wrap gap-2">
                  {gallery.map((url, i) => (
                    <div key={url + i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-600">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-black/70 text-white text-[10px] px-1"
                        onClick={() => setGallery((g) => g.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {gallery.length < 6 && (
                    <label className="w-16 h-16 rounded-lg border border-dashed border-stone-500 flex items-center justify-center text-stone-400 text-xs cursor-pointer">
                      {uploading === 'gallery' ? '…' : '+'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!!uploading}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f || !estId) return;
                          setUploading('gallery');
                          try {
                            const { url } = await uploadVitrineImage(estId, f, 'gallery');
                            setGallery((g) => [...g, url].slice(0, 6));
                            setOkMsg('Photo ajoutée — enregistrez la vitrine');
                          } catch (ex: any) {
                            setError(ex?.message || 'Upload galerie impossible');
                          }
                          setUploading(null);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} />
                Mettre en avant (Sponsorisé)
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => setShowStock(e.target.checked)}
                />
                Afficher les quantités disponibles sur le menu public
              </label>
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <p className="text-sm font-medium text-stone-200">Horaires (vitrine)</p>
                {DAY_LABELS.map(({ key, label }) => {
                  const slot = hours[key] || { open: '09:00', close: '23:00', closed: false };
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-16 text-stone-400">{label}</span>
                      <label className="flex items-center gap-1 text-stone-400">
                        <input
                          type="checkbox"
                          checked={Boolean(slot.closed)}
                          onChange={(e) =>
                            setHours((h) => ({
                              ...h,
                              [key]: { ...slot, closed: e.target.checked },
                            }))
                          }
                        />
                        Fermé
                      </label>
                      {!slot.closed && (
                        <>
                          <input
                            type="time"
                            className="input-field py-1 px-2 w-auto text-xs"
                            value={slot.open || '09:00'}
                            onChange={(e) =>
                              setHours((h) => ({
                                ...h,
                                [key]: { ...slot, open: e.target.value, closed: false },
                              }))
                            }
                          />
                          <span className="text-stone-600">→</span>
                          <input
                            type="time"
                            className="input-field py-1 px-2 w-auto text-xs"
                            value={slot.close || '23:00'}
                            onChange={(e) =>
                              setHours((h) => ({
                                ...h,
                                [key]: { ...slot, close: e.target.value, closed: false },
                              }))
                            }
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

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
