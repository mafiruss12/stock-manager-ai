import { DEFAULT_BRANDING, type BtpBranding } from '@/lib/btp';
import { isBtp } from '@/lib/businessTypes';
import { getStoredTheme, applyTheme, type ThemeMode } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { Building2, User, Save, CheckCircle2, Camera, Plus, Lock, KeyRound, RefreshCw, Download, Shield, MapPin, Loader2, Navigation } from 'lucide-react';
// MapPin used for GPS
import { requestMicrophone, resetPermissionsOnboarding, openAppSettings } from '@/lib/devicePermissions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PLAN, getSubscriptionState, paymentInstructions, paymentWhatsAppLink } from '@/lib/subscription';
import { APP_VERSION, fetchLatestRelease, fetchRemoteWebVersion, forceAppUpdate, isNewerVersion, WEB_APP_URL } from '@/lib/appVersion';
import type { Establishment } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

export default function SettingsPage() {
  const { member, activeEstablishment, refresh, signOut } = useAuth();
  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdForm, setPwdForm] = useState({ password: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', avatar_url: '' });
  const [form, setForm] = useState({ name: '', type: 'maquis', address: '', phone: '', logo_url: '', owner_email: '', owner_phone: '' });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; at?: string } | null>(null);
  const [btpBranding, setBtpBranding] = useState<BtpBranding>({ ...DEFAULT_BRANDING });
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageEst = member && ['super_admin', 'admin', 'owner'].includes(member.role);

  useEffect(() => {
    (async () => {
      if (member) {
        setProfileForm({
          full_name: member.full_name ?? '',
          avatar_url: (member as any).avatar_url ?? '',
        });
      }
      if (!member?.establishment_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', member.establishment_id)
        .maybeSingle();
      if (data) {
        setEst(data as Establishment);
        setForm({
          name: data.name,
          type: data.type,
          address: data.address ?? '',
          phone: data.phone ?? '',
          logo_url: (data as any).logo_url ?? '',
          owner_email: (data as any).owner_email ?? '',
          owner_phone: (data as any).owner_phone ?? '',
        });
        if ((data as any).latitude != null && (data as any).longitude != null) {
          setGpsCoords({
            lat: Number((data as any).latitude),
            lng: Number((data as any).longitude),
            at: (data as any).location_updated_at || undefined,
          });
        } else {
          setGpsCoords(null);
        }
      }
      setLoading(false);
    })();
  }, [member]);

  

  async function captureGps() {
    if (!est?.id) {
      setGpsMsg('Crée ou sélectionne d’abord un établissement.');
      return;
    }
    if (!navigator.geolocation) {
      setGpsMsg('La géolocalisation n’est pas supportée sur cet appareil.');
      return;
    }
    const ok = window.confirm(
      'Autoriser Stock Manager à enregistrer la position GPS de cet établissement ?\n\n' +
        'Utilisée uniquement pour que l’administrateur puisse mieux vous assister. Vous pouvez la mettre à jour à tout moment.',
    );
    if (!ok) return;
    setGpsLoading(true);
    setGpsMsg(null);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const at = new Date().toISOString();
        const { error: err } = await supabase
          .from('establishments')
          .update({
            latitude: lat,
            longitude: lng,
            location_updated_at: at,
          } as any)
          .eq('id', est.id);
        setGpsLoading(false);
        if (err) {
          setError(err.message);
          setGpsMsg(null);
          return;
        }
        setGpsCoords({ lat, lng, at });
        setGpsMsg('Position enregistrée avec succès.');
        setEst((prev) => (prev ? { ...prev, latitude: lat, longitude: lng, location_updated_at: at } : prev));
      },
      (geoErr) => {
        setGpsLoading(false);
        const messages: Record<number, string> = {
          1: 'Permission refusée. Autorise la localisation dans les paramètres du navigateur / de l’app.',
          2: 'Position indisponible. Active le GPS et réessaie.',
          3: 'Délai dépassé. Réessaie à l’extérieur ou avec une meilleure couverture.',
        };
        setGpsMsg(messages[geoErr.code] || geoErr.message);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function saveBtpBranding() {
    if (!est?.id) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('establishments')
      .update({ branding: btpBranding } as any)
      .eq('id', est.id);
    if (err) setError(err.message);
    else {
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 2500);
      await refresh();
    }
    setSaving(false);
  }

async function saveProfile() {
    if (!member) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from('members')
      .update({
        full_name: profileForm.full_name || null,
        avatar_url: profileForm.avatar_url || null,
      } as any)
      .eq('id', member.id);
    if (err) setError(err.message);
    else {
      setSaved(true);
      await refresh();
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  
  async function changePassword() {
    setPwdErr(null);
    setPwdMsg(null);
    if (pwdForm.password.length < 6) {
      setPwdErr('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (pwdForm.password !== pwdForm.confirm) {
      setPwdErr('Les mots de passe ne correspondent pas.');
      return;
    }
    setPwdSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwdForm.password });
    setPwdSaving(false);
    if (err) setPwdErr(err.message);
    else {
      setPwdMsg('Mot de passe mis à jour.');
      setPwdForm({ password: '', confirm: '' });
      setTimeout(() => setPwdMsg(null), 3000);
    }
  }

  async function saveEstablishment() {
    if (!member) return;
    setSaving(true);
    setError(null);

    if (est) {
      const { error: err } = await supabase
        .from('establishments')
        .update({
          name: form.name,
          type: form.type,
          address: form.address || null,
          phone: form.phone || null,
          logo_url: form.logo_url || null,
          owner_email: form.owner_email || null,
          owner_phone: form.owner_phone || null,
          owner_user_id: member.user_id,
        } as any)
        .eq('id', est.id);
      if (err) setError(err.message);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await refresh();
      }
    } else if (canManageEst) {
      // Créer l'établissement et rattacher le membre
      const { data: newEst, error: err } = await supabase
        .from('establishments')
        .insert({
          name: form.name || 'Mon établissement',
          type: form.type,
          address: form.address || null,
          phone: form.phone || null,
          logo_url: form.logo_url || null,
          created_by: member.user_id, subscription_status: 'trial', trial_ends_at: new Date(Date.now()+30*86400000).toISOString(),
        } as any)
        .select()
        .single();

      if (err || !newEst) {
        setError(err?.message ?? 'Erreur création établissement');
      } else {
        await supabase
          .from('members')
          .update({ establishment_id: newEst.id })
          .eq('id', member.id);
        await supabase.from('member_establishments').upsert(
          {
            user_id: member.user_id,
            establishment_id: newEst.id,
            role: member.role === 'employee' ? 'owner' : member.role,
            status: 'active',
          },
          { onConflict: 'user_id,establishment_id' }
        );
        setEst(newEst as Establishment);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        await refresh();
      }
    }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;

  return (
    <>
      {/* Thème */}
      
      {canManageEst && isBtp(form.type || est?.type) && (
        <section className="card p-4 space-y-3 border border-sky-500/30">
          <h2 className="font-semibold text-stone-100">En-tête & pied de page (devis / factures)</h2>
          <p className="text-xs text-stone-500">
            Ces informations apparaissent sur vos devis et factures BTP pour un rendu professionnel.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Activité / métier</label>
              <input className="input-field" value={btpBranding.activity || ''} onChange={(e) => setBtpBranding({ ...btpBranding, activity: e.target.value })} placeholder="Ex. Maçonnerie & gros œuvre" />
            </div>
            <div>
              <label className="label">Slogan</label>
              <input className="input-field" value={btpBranding.slogan || ''} onChange={(e) => setBtpBranding({ ...btpBranding, slogan: e.target.value })} placeholder="Ex. La qualité au service du chantier" />
            </div>
            <div>
              <label className="label">Email entreprise</label>
              <input className="input-field" value={btpBranding.email || ''} onChange={(e) => setBtpBranding({ ...btpBranding, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Site web</label>
              <input className="input-field" value={btpBranding.website || ''} onChange={(e) => setBtpBranding({ ...btpBranding, website: e.target.value })} />
            </div>
            <div>
              <label className="label">Ville</label>
              <input className="input-field" value={btpBranding.city || ''} onChange={(e) => setBtpBranding({ ...btpBranding, city: e.target.value })} />
            </div>
            <div>
              <label className="label">Pays</label>
              <input className="input-field" value={btpBranding.country || ''} onChange={(e) => setBtpBranding({ ...btpBranding, country: e.target.value })} />
            </div>
            <div>
              <label className="label">RCCM</label>
              <input className="input-field" value={btpBranding.rccm || ''} onChange={(e) => setBtpBranding({ ...btpBranding, rccm: e.target.value })} />
            </div>
            <div>
              <label className="label">NIF / IFU</label>
              <input className="input-field" value={btpBranding.nif || ''} onChange={(e) => setBtpBranding({ ...btpBranding, nif: e.target.value })} />
            </div>
            <div>
              <label className="label">N° TVA</label>
              <input className="input-field" value={btpBranding.tva_number || ''} onChange={(e) => setBtpBranding({ ...btpBranding, tva_number: e.target.value })} />
            </div>
            <div>
              <label className="label">Mobile Money</label>
              <input className="input-field" value={btpBranding.mobile_money || ''} onChange={(e) => setBtpBranding({ ...btpBranding, mobile_money: e.target.value })} placeholder="Orange / Wave / MTN…" />
            </div>
            <div>
              <label className="label">Banque</label>
              <input className="input-field" value={btpBranding.bank_name || ''} onChange={(e) => setBtpBranding({ ...btpBranding, bank_name: e.target.value })} />
            </div>
            <div>
              <label className="label">IBAN / compte</label>
              <input className="input-field" value={btpBranding.iban || ''} onChange={(e) => setBtpBranding({ ...btpBranding, iban: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Note d&apos;en-tête (sous le logo)</label>
            <input className="input-field" value={btpBranding.header_note || ''} onChange={(e) => setBtpBranding({ ...btpBranding, header_note: e.target.value })} placeholder="Ex. Agréé marchés publics" />
          </div>
          <div>
            <label className="label">Pied de page</label>
            <textarea className="input-field min-h-[60px]" value={btpBranding.footer_text || ''} onChange={(e) => setBtpBranding({ ...btpBranding, footer_text: e.target.value })} placeholder="Merci de votre confiance. Contact…" />
          </div>
          <div>
            <label className="label">Mentions légales / conditions</label>
            <textarea className="input-field min-h-[70px]" value={btpBranding.legal_notice || ''} onChange={(e) => setBtpBranding({ ...btpBranding, legal_notice: e.target.value })} />
          </div>
          <div>
            <label className="label">Conditions de paiement par défaut</label>
            <textarea className="input-field min-h-[50px]" value={btpBranding.payment_terms_default || ''} onChange={(e) => setBtpBranding({ ...btpBranding, payment_terms_default: e.target.value })} />
          </div>
          <div>
            <label className="label">URL cachet / signature (image)</label>
            <input className="input-field" value={btpBranding.stamp_url || ''} onChange={(e) => setBtpBranding({ ...btpBranding, stamp_url: e.target.value })} placeholder="https://… ou data:image…" />
            <input type="file" accept="image/*" className="mt-2 text-xs text-stone-400" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 800_000) { setError('Image trop lourde (max 800 Ko)'); return; }
              const r = new FileReader();
              r.onload = () => setBtpBranding({ ...btpBranding, stamp_url: String(r.result || '') });
              r.readAsDataURL(f);
            }} />
            {btpBranding.stamp_url && <img src={btpBranding.stamp_url} alt="Cachet" className="mt-2 h-16 object-contain" />}
          </div>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void saveBtpBranding()}>
            {saving ? '…' : brandingSaved ? 'Enregistré ✓' : 'Enregistrer en-tête & pied de page'}
          </button>
        </section>
      )}

<section className="card p-4 space-y-3">
        <h2 className="font-semibold text-stone-100 flex items-center gap-2">Apparence</h2>
        <p className="text-sm text-stone-400">Choisissez le mode d’affichage de l’application.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-medium ${
              themeMode === 'light'
                ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                : 'border-stone-700 bg-stone-900 text-stone-300'
            }`}
            onClick={() => {
              applyTheme('light');
              setThemeMode('light');
            }}
          >
            ☀️ Mode jour
          </button>
          <button
            type="button"
            className={`min-h-[48px] rounded-xl border px-3 py-2 text-sm font-medium ${
              themeMode === 'dark'
                ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                : 'border-stone-700 bg-stone-900 text-stone-300'
            }`}
            onClick={() => {
              applyTheme('dark');
              setThemeMode('dark');
            }}
          >
            🌙 Mode sombre
          </button>
        </div>
      </section>

    {activeEstablishment && (
      <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-stone-200">
        <p className="font-semibold text-amber-200 mb-1">Abonnement</p>
        <p>{getSubscriptionState(activeEstablishment).message || getSubscriptionState(activeEstablishment).label}</p>
        <p className="text-xs text-stone-400 mt-2 whitespace-pre-wrap">{paymentInstructions()}</p>
        <a
          href={paymentWhatsAppLink(`Bonjour, paiement abonnement Stock Manager — ${activeEstablishment?.name || ''}`)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex mt-3 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          Contacter pour payer (WhatsApp)
        </a>
      </div>
    )}

    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Profil & Paramètres</h1>

      <div className="card mb-4 space-y-2 border-amber-500/20">
        <p className="font-medium text-stone-100 flex items-center gap-2">
          <Shield size={18} className="text-amber-400" /> Autorisations appareil
        </p>
        <p className="text-sm text-stone-400">
          Micro, caméra, notifications, GPS — nécessaires pour la dictée, les photos et les rappels.
        </p>
        <button
          type="button"
          className="btn-primary w-full min-h-[48px]"
          onClick={() => void openAppSettings()}
        >
          Ouvrir les paramètres du téléphone
        </button>
        <button
          type="button"
          className="btn-secondary w-full min-h-[44px]"
          onClick={() => {
            resetPermissionsOnboarding();
            window.dispatchEvent(new Event('mm-request-permissions'));
          }}
        >
          Afficher l’écran d’autorisations
        </button>
      </div>
      <p className="text-sm text-stone-400 mt-2">
        Pour autoriser un employé à modifier le stock : allez dans <a href="/mes-employes" className="text-amber-400 underline">Équipe</a> et cochez « Modifier stock ».
      </p>
      <p className="text-stone-400 text-sm mb-6">Personnalisez votre compte et votre établissement</p>

      {error && (
        <div className="mb-4 bg-error-500/10 border border-error-500/30 rounded-xl p-3 text-sm text-error-300">
          {error}
        </div>
      )}

      <div className="max-w-lg space-y-6">
        {/* Profil */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
            <User size={20} className="text-primary-400" /> Mon profil
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-stone-700 flex items-center justify-center overflow-hidden shrink-0">
              {profileForm.avatar_url ? (
                <img src={profileForm.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-stone-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <label className="label flex items-center gap-1"><Camera size={14} /> Photo (URL)</label>
              <input
                value={profileForm.avatar_url}
                onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                placeholder="https://..."
                className="input-field"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="label">Nom complet</label>
              <input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Email</span>
              <span className="text-stone-200">{member?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-400">Rôle</span>
              <span className="text-stone-200">{member?.role ? ROLE_LABELS[member.role] : '—'}</span>
            </div>
            <button onClick={saveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              {saved ? <><CheckCircle2 size={18} /> Enregistré !</> : <><Save size={18} /> Enregistrer le profil</>}
            </button>
          </div>
        </div>

        {/* Mot de passe */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
            <KeyRound size={20} className="text-amber-400" /> Sécurité — Mot de passe
          </h2>
          {pwdErr && (
            <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{pwdErr}</div>
          )}
          {pwdMsg && (
            <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{pwdMsg}</div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Nouveau mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="password"
                  value={pwdForm.password}
                  onChange={(e) => setPwdForm({ ...pwdForm, password: e.target.value })}
                  className="input-field pl-10"
                  placeholder="Min. 6 caractères"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label className="label">Confirmer</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="password"
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  className="input-field pl-10"
                  placeholder="Retapez le mot de passe"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button onClick={changePassword} disabled={pwdSaving} className="btn-primary w-full flex items-center justify-center gap-2">
              {pwdSaving ? 'Enregistrement…' : 'Changer le mot de passe'}
            </button>
          </div>
        </div>

        {/* Établissement */}
        <div className="card">
          <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-secondary-400" />
            {est ? 'Mon établissement' : 'Créer mon établissement'}
          </h2>

          {!est && !canManageEst && (
            <p className="text-stone-400 text-sm">Aucun établissement rattaché. Contactez votre administrateur ou propriétaire.</p>
          )}

          {(est || canManageEst) && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 rounded-xl bg-stone-700 flex items-center justify-center overflow-hidden shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 size={28} className="text-stone-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="label flex items-center gap-1"><Camera size={14} /> Logo / Photo (URL)</label>
                  <input
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    placeholder="https://..."
                    className="input-field"
                    disabled={!canManageEst}
                  />
                </div>
              </div>
              <div>
                <label className="label">Nom de l'établissement</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Maquis Chez Koffi"
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                >
                  <option value="maquis">Maquis</option>
                                                      <option value="magasin">Magasin</option>
                  <option value="boutique">Boutique</option>
                  <option value="superette">Supérette</option>
                                    <option value="quincaillerie">Quincaillerie</option>
                                    <option value="location_event">Location événementielle</option>
                </select>
                <p className="text-xs text-stone-500 mt-1">Change le menu, le thème et le tableau de bord.</p>
              </div>
              <div>
                <label className="label">Adresse</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-field"
                  disabled={!canManageEst && !!est}
                />
              </div>
              {canManageEst && (
                <>
                  
                <div className="sm:col-span-2 mt-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs font-semibold text-amber-200 mb-2">Contacts propriétaire (rapports & alertes)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">E-mail du propriétaire</label>
                      <input
                        type="email"
                        value={form.owner_email}
                        onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                        className="input-field"
                        placeholder="proprio@email.com"
                      />
                    </div>
                    <div>
                      <label className="label">WhatsApp du propriétaire</label>
                      <input
                        value={form.owner_phone}
                        onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                        className="input-field"
                        placeholder="07 XX XX XX XX"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2">Quand un gérant/caissier verrouille le rapport, vous êtes notifié in-app + e-mail + WhatsApp.</p>
                </div>


                <div className="rounded-xl border border-sky-700/40 bg-sky-950/30 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-sky-300 flex items-center gap-2">
                    <MapPin size={16} /> Position GPS de l’établissement
                  </h3>
                  <p className="text-xs text-stone-400">
                    Enregistre la position exacte pour que l’équipe Kevin Tech Pro puisse mieux t’assister.
                    Uniquement l’administrateur voit cette position.
                  </p>
                  {gpsCoords && (
                    <div className="text-xs text-stone-300 space-y-1">
                      <p className="font-mono">
                        {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                      </p>
                      {gpsCoords.at && (
                        <p className="text-stone-500">Mis à jour : {new Date(gpsCoords.at).toLocaleString('fr-FR')}</p>
                      )}
                      <a
                        className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                        href={`https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Navigation size={12} /> Voir sur Maps
                      </a>
                    </div>
                  )}
                  {gpsMsg && <p className="text-xs text-emerald-400">{gpsMsg}</p>}
                  <button
                    type="button"
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                    disabled={gpsLoading || !est}
                    onClick={() => void captureGps()}
                  >
                    {gpsLoading ? (
                      <><Loader2 size={18} className="animate-spin" /> Localisation…</>
                    ) : (
                      <><MapPin size={18} /> {gpsCoords ? 'Mettre à jour ma position GPS' : 'Enregistrer ma position GPS'}</>
                    )}
                  </button>
                </div>

                  <button onClick={saveEstablishment} disabled={saving || !form.name} className="btn-primary w-full flex items-center justify-center gap-2">
                    {saved ? (
                      <><CheckCircle2 size={18} /> Enregistré !</>
                    ) : est ? (
                      <><Save size={18} /> Enregistrer l'établissement</>
                    ) : (
                      <><Plus size={18} /> Créer mon établissement</>
                    )}
                  </button>
                  {est && (
                    <button
                      type="button"
                      className="btn-secondary w-full flex items-center justify-center gap-2 mt-2"
                      onClick={() => {
                        setEst(null);
                        setForm({ name: '', type: 'maquis', address: '', phone: '', logo_url: '', owner_email: '', owner_phone: '' });
                      }}
                    >
                      <Plus size={18} /> Ajouter une autre activité
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Mises à jour */}
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-stone-100">Mises à jour</h2>
          <p className="text-sm text-stone-400">
            Version actuelle : <span className="text-stone-200 font-mono">v{APP_VERSION}</span>
          </p>
          <p className="text-xs text-stone-500">
            Appuie sur <strong className="text-stone-300">Mettre à jour</strong> pour charger les dernières fonctions
            (location, catégories, corrections…). Cela vide le cache et recharge l&apos;app.
          </p>
          <button
            type="button"
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={async () => {
              try {
                const remote = await fetchRemoteWebVersion();
                if (remote?.version && isNewerVersion(remote.version)) {
                  const ok = confirm(
                    `Nouvelle version v${remote.version} disponible.\n${remote.notes || ''}\n\nMettre à jour maintenant ?`
                  );
                  if (!ok) return;
                }
              } catch { /* force update anyway */ }
              await forceAppUpdate();
            }}
          >
            <RefreshCw size={18} /> Mettre à jour
          </button>
          <button
            type="button"
            className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
            onClick={async () => {
              const latest = await fetchLatestRelease();
              if (!latest) {
                alert('Impossible de vérifier les APK sur GitHub pour le moment.');
                return;
              }
              if (isNewerVersion(latest.tag)) {
                if (confirm(`Nouvelle APK v${latest.tag} disponible. Télécharger ?`)) {
                  window.open(latest.apkUrl || latest.htmlUrl, '_blank');
                }
              } else {
                alert(`APK à jour (v${APP_VERSION}). Pour le contenu : utilise « Mettre à jour ».`);
              }
            }}
          >
            <Download size={16} /> Vérifier nouvelle APK
          </button>
          <p className="text-[11px] text-stone-600">
            Site : {WEB_APP_URL}
          </p>
        </div>


        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-stone-100">Autorisations téléphone</h2>
          <p className="text-sm text-stone-400">
            Microphone, caméra, localisation, notifications — indispensables sur le terrain.
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={async () => {
              const r = await requestMicrophone();
              alert(r.ok ? 'Microphone autorisé ✓' : `Micro : ${r.detail}`);
            }}
          >
            Autoriser le microphone
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              resetPermissionsOnboarding();
              window.dispatchEvent(new Event('mm-request-permissions'));
            }}
          >
            Redemander toutes les autorisations
          </button>
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-stone-100">Session</h2>
          <button
            type="button"
            className="btn-secondary w-full flex items-center justify-center gap-2 text-error-300 border-error-500/30"
            onClick={async () => {
              await signOut();
              window.location.assign('/');
            }}
          >
            Se déconnecter
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
