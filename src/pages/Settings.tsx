import { getStoredTheme, applyTheme, type ThemeMode } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { Building2, User, Save, CheckCircle2, Camera, Plus, Lock, KeyRound, RefreshCw, Download, Shield } from 'lucide-react';
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
        });
      }
      setLoading(false);
    })();
  }, [member]);

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
