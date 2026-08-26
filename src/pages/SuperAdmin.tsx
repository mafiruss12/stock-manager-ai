import { useEffect, useState } from 'react';
import { UserCog, Building2, Users, Plus, Check, X, Loader2, Ban, KeyRound, Trash2, Clock, Mail, RefreshCw, Copy, CheckCircle2, Pencil, Activity, Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Member, Establishment, AccessRequest, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { Modal, Badge, EmptyState } from '@/components/ui';
import { toAuthEmail, displayLogin, generatePassword, generateLogin } from '@/lib/login';
import {
  PLAN, SUB_PERIODS, priceForMonths, addMonthsISO, getSubscriptionState,
  getPaymentWhatsApp, setPaymentWhatsApp, paymentWhatsAppLink } from '@/lib/subscription';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '@/lib/totp';

type Tab = 'requests' | 'members' | 'establishments' | 'subscriptions' | 'activity' | 'pubs';

export default function SuperAdmin() {
  const { member } = useAuth();
  const [tab, setTab] = useState<Tab>('members');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pubList, setPubList] = useState<{ id: string; title: string; body: string; link_url: string | null; image_url: string | null; active: boolean; sort_order: number }[]>([]);
  const [pubForm, setPubForm] = useState({ title: '', body: '', link_url: '', image_url: '', active: true, sort_order: 0 });
  const [pubEditing, setPubEditing] = useState<string | null>(null);
  const [pubSaving, setPubSaving] = useState(false);

  const [approveModal, setApproveModal] = useState<AccessRequest | null>(null);
  const [estModal, setEstModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editEst, setEditEst] = useState<Establishment | null>(null);

  const [estForm, setEstForm] = useState({ name: '', type: 'maquis', address: '', phone: '' });
  const [subMonths, setSubMonths] = useState(1);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaTestCode, setMfaTestCode] = useState('');
  const [waPhone, setWaPhone] = useState(() => {
    try { return getPaymentWhatsApp(); } catch { return '2250502012011'; }
  });
  const [approveForm, setApproveForm] = useState<{ role: Role; establishmentId: string }>({
    role: 'employee',
    establishmentId: '' });
  const [memberEditForm, setMemberEditForm] = useState({
    full_name: '',
    role: 'employee' as Role,
    establishment_id: '',
    status: 'active' as 'active' | 'suspended' });
  const [estEditForm, setEstEditForm] = useState({
    name: '',
    type: 'maquis',
    address: '',
    phone: '' });

  async function loadData() {
    setLoading(true);
    const [reqRes, memRes, estRes, pubRes] = await Promise.all([
      supabase.from('access_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('establishments').select('*').order('created_at', { ascending: false }),
      supabase.from('app_announcements').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
    ]);
    setRequests((reqRes.data ?? []) as AccessRequest[]);
    setMembers((memRes.data ?? []) as Member[]);
    setEstablishments((estRes.data ?? []) as Establishment[]);
    setPubList((pubRes.data ?? []) as typeof pubList);
    const errs = [reqRes.error?.message, memRes.error?.message, estRes.error?.message].filter(Boolean);
    if (errs.length) setError(errs.join(' · '));
    else setError(null);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    const id = window.setInterval(() => { void loadData(); }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
  }

  function safeDateInput(iso?: string | null): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }


  async function approveRequest(req: AccessRequest) {
    if (!req.user_id || !approveForm.establishmentId) return;
    setActionLoading(req.id);
    try {
      await supabase.from('members').upsert(
        {
          user_id: req.user_id,
          email: req.email,
          full_name: req.full_name,
          role: approveForm.role,
          establishment_id: approveForm.establishmentId,
          status: 'active' },
        { onConflict: 'user_id' }
      );
      await supabase.from('access_requests').update({ status: 'approved' }).eq('id', req.id);
      setApproveModal(null);
      setApproveForm({ role: 'employee', establishmentId: '' });
      await loadData();
      flash('Accès approuvé');
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectRequest(req: AccessRequest) {
    if (!confirm(`Refuser la demande de ${req.email} ?`)) return;
    setActionLoading(req.id);
    try {
      await supabase.from('access_requests').update({ status: 'rejected' }).eq('id', req.id);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleSuspend(m: Member) {
    const newStatus = m.status === 'active' ? 'suspended' : 'active';
    const { error: err } = await supabase.from('members').update({ status: newStatus }).eq('id', m.id);
    if (err) setError(err.message);
    else {
      flash(newStatus === 'active' ? 'Compte réactivé' : 'Compte suspendu');
      await loadData();
      if (editMember?.id === m.id) {
        setEditMember({ ...m, status: newStatus });
        setMemberEditForm((f) => ({ ...f, status: newStatus }));
      }
    }
  }

  async function deleteMember(m: Member) {
    if (!confirm(`Supprimer le profil membre de ${m.full_name || m.email} ?`)) return;
    const { error: err } = await supabase.from('members').delete().eq('id', m.id);
    if (err) setError(err.message);
    else {
      setEditMember(null);
      flash('Membre retiré');
      await loadData();
    }
  }

  async function saveMemberEdit() {
    if (!editMember) return;
    setActionLoading(editMember.id);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        full_name: memberEditForm.full_name || null,
        role: memberEditForm.role,
        status: memberEditForm.status,
        establishment_id: memberEditForm.establishment_id || null };
      // Ne pas rétrograder le super_admin courant
      if (editMember.role === 'super_admin') {
        payload.role = 'super_admin';
      }
      const { error: err } = await supabase.from('members').update(payload).eq('id', editMember.id);
      if (err) {
        setError(err.message);
        return;
      }
      if (memberEditForm.establishment_id && editMember.user_id) {
        await supabase.from('member_establishments').upsert(
          {
            user_id: editMember.user_id,
            establishment_id: memberEditForm.establishment_id,
            role: memberEditForm.role,
            status: 'active' },
          { onConflict: 'user_id,establishment_id' }
        );
      }
      flash('Accès mis à jour');
      setEditMember(null);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function enableAdminMfa() {
    if (!member?.user_id) return;
    const secret = generateTotpSecret();
    setMfaSecret(secret);
    setMfaQr(otpauthUrl(secret, member.email || member.user_id));
  }

  async function confirmAdminMfa() {
    if (!member?.user_id || !mfaSecret) return;
    const ok = await verifyTotp(mfaSecret, mfaTestCode);
    if (!ok) {
      setError('Code 2FA incorrect — vérifiez Google Authenticator / Authy');
      return;
    }
    const { error: err } = await supabase.from('members').update({
      mfa_enabled: true,
      mfa_secret: mfaSecret }).eq('user_id', member.user_id);
    if (err) setError(err.message + ' (colonnes mfa_enabled / mfa_secret requises)');
    else {
      flash('2FA admin activée');
      setMfaSecret(null);
      setMfaQr(null);
      setMfaTestCode('');
    }
  }

  async function disableAdminMfa() {
    if (!member?.user_id) return;
    if (!confirm('Désactiver la double authentification ?')) return;
    const { error: err } = await supabase.from('members').update({
      mfa_enabled: false,
      mfa_secret: null }).eq('user_id', member.user_id);
    if (err) setError(err.message);
    else flash('2FA désactivée');
  }

  async function activateSubscription(estId: string, months: number) {
    const est = establishments.find((e) => e.id === estId);
    const now = new Date();
    let start = now;
    if (est?.subscription_ends_at) {
      const cur = new Date(est.subscription_ends_at);
      if (cur > now) start = cur;
    }
    const endISO = addMonthsISO(start, months);
    const total = priceForMonths(months);
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'active',
      subscription_ends_at: endISO,
      last_payment_at: new Date().toISOString() }).eq('id', estId);
    if (err) setError(err.message);
    else {
      flash(`Abonnement +${months} mois activé (${total.toLocaleString('fr-FR')} F) jusqu'au ${new Date(endISO).toLocaleDateString('fr-FR')}`);
      await loadData();
    }
  }

  async function setTrialDays(estId: string, days: number) {
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'trial',
      trial_ends_at: end.toISOString() }).eq('id', estId);
    if (err) setError(err.message);
    else {
      flash(`Essai prolongé de ${days} jours`);
      await loadData();
    }
  }

  async function setExactEndDate(estId: string, isoDate: string) {
    const end = new Date(isoDate);
    end.setHours(23, 59, 59, 999);
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'active',
      subscription_ends_at: end.toISOString(),
      last_payment_at: new Date().toISOString() }).eq('id', estId);
    if (err) setError(err.message);
    else {
      flash(`Fin d'abonnement fixée au ${end.toLocaleDateString('fr-FR')}`);
      await loadData();
    }
  }

  async function suspendSubscription(estId: string) {
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'suspended' }).eq('id', estId);
    if (err) setError(err.message);
    else {
      flash('Établissement suspendu');
      await loadData();
    }
  }

  async function createEstablishment() {
    if (!estForm.name || !member) return;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    const { error: err } = await supabase.from('establishments').insert({
      name: estForm.name,
      type: estForm.type,
      address: estForm.address || null,
      phone: estForm.phone || null,
      created_by: member.user_id,
      subscription_status: 'trial',
      trial_ends_at: trialEnd.toISOString() });
    if (err) setError(err.message);
    else {
      setEstModal(false);
      setEstForm({ name: '', type: 'maquis', address: '', phone: '' });
      flash('Établissement créé');
      await loadData();
    }
  }

  async function saveEstEdit() {
    if (!editEst) return;
    setActionLoading(editEst.id);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('establishments')
        .update({
          name: estEditForm.name,
          type: estEditForm.type,
          address: estEditForm.address || null,
          phone: estEditForm.phone || null })
        .eq('id', editEst.id);
      if (err) {
        setError(err.message);
        return;
      }
      flash('Établissement mis à jour');
      setEditEst(null);
      await loadData();
    } finally {
      setActionLoading(null);
    }
  }

  async function removeMemberFromEst(m: Member) {
    if (!editEst) return;
    if (!confirm(`Retirer ${m.full_name || m.email} de ${editEst.name} ?`)) return;
    await supabase.from('members').update({ establishment_id: null }).eq('id', m.id);
    await loadData();
    flash('Membre retiré de l\'établissement');
  }

  async function deleteEstablishment(est: Establishment) {
    const count = members.filter((m) => m.establishment_id === est.id).length;
    const msg =
      count > 0
        ? `Supprimer « ${est.name} » et détacher ${count} membre(s) ? Cette action est définitive.`
        : `Supprimer l'établissement « ${est.name} » ?`;
    if (!confirm(msg)) return;
    setActionLoading(est.id);
    try {
      // Détacher les membres
      await supabase.from('members').update({ establishment_id: null }).eq('establishment_id', est.id);
      await supabase.from('member_establishments').delete().eq('establishment_id', est.id);
      const { error: err } = await supabase.from('establishments').delete().eq('id', est.id);
      if (err) setError(err.message);
      else {
        setEditEst(null);
        flash('Établissement supprimé');
        await loadData();
      }
    } finally {
      setActionLoading(null);
    }
  }

  function openEditMember(m: Member) {
    setError(null);
    setEditMember(m);
    setMemberEditForm({
      full_name: m.full_name || '',
      role: m.role,
      establishment_id: m.establishment_id || '',
      status: m.status === 'suspended' ? 'suspended' : 'active' });
  }

  function openEditEst(est: Establishment) {
    setError(null);
    setEditEst(est);
    setEstEditForm({
      name: est.name,
      type: est.type || 'maquis',
      address: est.address || '',
      phone: est.phone || '' });
  }


  function minutesAgo(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 60000);
  }
  function activityLabel(iso: string | null | undefined): { text: string; color: 'success' | 'warning' | 'error' | 'neutral' } {
    const m = minutesAgo(iso);
    if (m === null) return { text: 'Jamais vu', color: 'neutral' };
    if (m < 5) return { text: 'En ligne', color: 'success' };
    if (m < 60) return { text: `Il y a ${m} min`, color: 'success' };
    if (m < 24 * 60) return { text: `Il y a ${Math.floor(m / 60)} h`, color: 'warning' };
    return { text: `Il y a ${Math.floor(m / (24 * 60))} j`, color: 'neutral' };
  }
  const onlineMembers = members.filter((m) => {
    const mins = minutesAgo((m as any).last_seen);
    return mins !== null && mins < 15;
  });
  const active24h = members.filter((m) => {
    const mins = minutesAgo((m as any).last_seen);
    return mins !== null && mins < 24 * 60;
  });

  if (member?.role !== 'super_admin') {
    return (
      <EmptyState
        icon={<UserCog size={48} />}
        title="Accès refusé"
        message="Cette section est réservée au Super Administrateur."
      />
    );
  }

  
  async function loadPubs() {
    const { data } = await supabase.from('app_announcements').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    setPubList((data ?? []) as typeof pubList);
  }

  async function savePub() {
    if (!pubForm.body.trim() && !pubForm.image_url.trim()) {
      setError('Ajoutez un texte et/ou une image pour la publicité.');
      return;
    }
    setPubSaving(true);
    setError(null);
    const payload = {
      title: pubForm.title.trim(),
      body: pubForm.body.trim(),
      link_url: pubForm.link_url.trim() || null,
      image_url: pubForm.image_url.trim() || null,
      active: pubForm.active,
      sort_order: Number(pubForm.sort_order) || 0,
      updated_at: new Date().toISOString(),
      created_by: member?.user_id || null,
    };
    try {
      if (pubEditing) {
        const { error } = await supabase.from('app_announcements').update(payload).eq('id', pubEditing);
        if (error) throw error;
        flash('Publicité mise à jour');
      } else {
        const { error } = await supabase.from('app_announcements').insert(payload);
        if (error) throw error;
        flash('Publicité ajoutée');
      }
      setPubForm({ title: '', body: '', link_url: '', image_url: '', active: true, sort_order: 0 });
      setPubEditing(null);
      await loadPubs();
    } catch (e: any) {
      setError(e?.message || 'Erreur enregistrement pub');
    }
    setPubSaving(false);
  }

  async function deletePub(id: string) {
    if (!confirm('Supprimer cette publicité ?')) return;
    const { error } = await supabase.from('app_announcements').delete().eq('id', id);
    if (error) setError(error.message);
    else {
      flash('Publicité supprimée');
      await loadPubs();
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  }

  const pendingCount = requests.length;
  const estMembers = editEst ? members.filter((m) => m.establishment_id === editEst.id) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold font-display text-stone-100 mb-2">Administration</h1>
      <p className="text-stone-400 text-sm mb-4">
        Cliquez sur un membre ou un établissement pour le modifier
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{success}</div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(
          [
            ['requests', <Clock size={16} key="c" />, 'Demandes'],
            ['members', <Users size={16} key="u" />, 'Membres'],
            ['establishments', <Building2 size={16} key="b" />, 'Établissements'],
            ['subscriptions', <KeyRound size={16} key="s" />, 'Abonnements'],
            ['activity', <Activity size={16} key="a" />, 'Activité'],
            ['pubs', <Megaphone size={16} key="p" />, 'Publicités'],
          ] as const
        ).map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
              tab === id ? 'bg-primary-500/15 text-primary-300' : 'text-stone-400 hover:bg-stone-800'
            }`}
          >
            {icon} {label}
            {id === 'requests' && pendingCount > 0 && <Badge color="warning">{pendingCount}</Badge>}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div>
          {requests.length === 0 ? (
            <EmptyState icon={<Clock size={48} />} title="Aucune demande" message="Les inscriptions en attente apparaîtront ici." />
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="card flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/15">
                    <Mail size={20} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 truncate">{req.full_name || req.email}</p>
                    <p className="text-sm text-stone-400">{req.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setApproveModal(req);
                      setApproveForm({ role: 'employee', establishmentId: establishments[0]?.id || '' });
                    }}
                    className="btn-primary text-xs py-2"
                  >
                    Approuver
                  </button>
                  <button onClick={() => rejectRequest(req)} className="btn-ghost text-xs text-red-400">
                    Refuser
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setMemberModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Créer un accès
            </button>
          </div>
          {members.length === 0 ? (
            <EmptyState icon={<Users size={48} />} title="Aucun membre" message="Créez le premier accès." />
          ) : (
            <div className="space-y-2">
              {members.map((m) => {
                const est = establishments.find((e) => e.id === m.establishment_id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openEditMember(m)}
                    className="card w-full flex items-center gap-4 text-left hover:border-primary-500/40 transition-colors cursor-pointer"
                  >
                    <div className="p-2.5 rounded-xl bg-stone-800">
                      <Users size={20} className="text-stone-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-stone-100 truncate">{m.full_name ?? m.email}</p>
                        <Badge color={m.status === 'active' ? 'success' : 'error'}>
                          {m.status === 'active' ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                      <p className="text-sm text-stone-400">
                        {displayLogin(m.email)} · {ROLE_LABELS[m.role]} · {est?.name ?? 'Aucun établissement'}
                      </p>
                    </div>
                    <Pencil size={16} className="text-stone-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'establishments' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setEstModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> Créer un établissement
            </button>
          </div>
          {establishments.length === 0 ? (
            <EmptyState icon={<Building2 size={48} />} title="Aucun établissement" message="Créez le premier." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {establishments.map((est) => {
                const count = members.filter((m) => m.establishment_id === est.id).length;
                return (
                  <div
                    key={est.id}
                    className="card text-left hover:border-primary-500/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => openEditEst(est)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-sky-500/15">
                          <Building2 size={20} className="text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-100">{est.name}</p>
                          <p className="text-[11px] text-stone-500">Abo: {(est as any).subscription_status || 'trial'}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <button type="button" className="text-[11px] px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200" onClick={() => activateSubscription(est.id, subMonths)}>Activer {subMonths} mois</button>
                            <button type="button" className="text-[11px] px-2 py-0.5 rounded bg-red-600/30 text-red-200" onClick={() => suspendSubscription(est.id)}>Suspendre</button>
                          </div>
                          <p className="text-sm text-stone-400">{est.type || 'maquis'}</p>
                          {est.address && <p className="text-xs text-stone-500 mt-1">{est.address}</p>}
                          {est.phone && <p className="text-xs text-stone-500">{est.phone}</p>}
                          <p className="text-xs text-stone-500 mt-2">{count} membre{count > 1 ? 's' : ''}</p>
                        </div>
                        <Pencil size={16} className="text-stone-500" />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEstablishment(est)}
                      className="mt-3 w-full text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl py-2 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} /> Supprimer l&apos;établissement
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Approve request */}
      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title="Approuver la demande">
        {approveModal && (
          <div className="space-y-3">
            <p className="text-sm text-stone-300">{approveModal.full_name || approveModal.email}</p>
            <div>
              <label className="label">Rôle</label>
              <select
                value={approveForm.role}
                onChange={(e) => setApproveForm({ ...approveForm, role: e.target.value as Role })}
                className="input-field"
              >
                {(Object.keys(ROLE_LABELS) as Role[])
                  .filter((r) => r !== 'super_admin')
                  .map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Établissement</label>
              <select
                value={approveForm.establishmentId}
                onChange={(e) => setApproveForm({ ...approveForm, establishmentId: e.target.value })}
                className="input-field"
              >
                <option value="">— Choisir —</option>
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => approveRequest(approveModal)}
              disabled={actionLoading === approveModal.id || !approveForm.establishmentId}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {actionLoading === approveModal.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Confirmer l&apos;accès
            </button>
          </div>
        )}
      </Modal>

      {/* Create establishment */}


      {tab === 'activity' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card">
              <p className="text-xs text-stone-500">Comptes totaux</p>
              <p className="text-2xl font-bold text-stone-100">{members.length}</p>
            </div>
            <div className="card">
              <p className="text-xs text-stone-500">En ligne (&lt; 15 min)</p>
              <p className="text-2xl font-bold text-emerald-400">{onlineMembers.length}</p>
            </div>
            <div className="card">
              <p className="text-xs text-stone-500">Actifs 24 h</p>
              <p className="text-2xl font-bold text-amber-300">{active24h.length}</p>
            </div>
            <div className="card">
              <p className="text-xs text-stone-500">Établissements</p>
              <p className="text-2xl font-bold text-stone-100">{establishments.length}</p>
            </div>
          </div>
          <p className="text-sm text-stone-400">
            Suivi basé sur la dernière activité dans l&apos;app (mise à jour ~1 min).
          </p>
          <div className="space-y-2">
            {[...members]
              .sort((a, b) => {
                const ta = (a as any).last_seen ? new Date((a as any).last_seen).getTime() : 0;
                const tb = (b as any).last_seen ? new Date((b as any).last_seen).getTime() : 0;
                return tb - ta;
              })
              .map((m) => {
                const est = establishments.find((e) => e.id === m.establishment_id);
                const act = activityLabel((m as any).last_seen);
                return (
                  <div key={m.id} className="card flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-100 truncate">{m.full_name || m.email}</p>
                      <p className="text-xs text-stone-500 truncate">
                        {ROLE_LABELS[m.role]} · {est?.name || 'Sans établissement'} · {displayLogin(m.email)}
                      </p>
                    </div>
                    <Badge color={act.color}>{act.text}</Badge>
                    <Badge color={m.status === 'active' ? 'success' : 'error'}>
                      {m.status === 'active' ? 'Compte OK' : 'Suspendu'}
                    </Badge>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      
      {tab === 'pubs' && (
        <div className="space-y-4">
          <div className="card space-y-3 border border-amber-500/30">
            <h2 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
              <Megaphone size={18} className="text-amber-400" /> Publicités &amp; annonces
            </h2>
            <p className="text-xs text-stone-500">
              Ces messages défilent sur la <strong className="text-stone-300">page de connexion</strong> et le <strong className="text-stone-300">tableau de bord</strong> de tous les utilisateurs.
            </p>
            <input
              className="input-field"
              placeholder="Titre (optionnel)"
              value={pubForm.title}
              onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
            />
            <textarea
              className="input-field min-h-[80px]"
              placeholder="Texte de la pub / information *"
              value={pubForm.body}
              onChange={(e) => setPubForm({ ...pubForm, body: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Lien (optionnel) https://..."
              value={pubForm.link_url}
              onChange={(e) => setPubForm({ ...pubForm, link_url: e.target.value })}
            />
            <div className="space-y-2">
              <p className="text-xs text-stone-400">Image (optionnel)</p>
              <div className="flex flex-wrap items-center gap-3">
                {pubForm.image_url ? (
                  <img
                    src={pubForm.image_url}
                    alt="Aperçu pub"
                    className="h-20 w-20 rounded-xl object-cover border border-stone-700"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-xl border border-dashed border-stone-600 flex items-center justify-center text-stone-500 text-xs">
                    Aperçu
                  </div>
                )}
                <div className="flex-1 min-w-[180px] space-y-2">
                  <input
                    className="input-field"
                    placeholder="URL image https://... ou choisir un fichier"
                    value={pubForm.image_url.startsWith('data:') ? '' : pubForm.image_url}
                    onChange={(e) => setPubForm({ ...pubForm, image_url: e.target.value })}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-xs text-stone-400"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1_200_000) {
                        setError('Image trop lourde (max ~1 Mo). Compressez-la.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const data = String(reader.result || '');
                        setPubForm((prev) => ({ ...prev, image_url: data }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {pubForm.image_url && (
                    <button
                      type="button"
                      className="text-xs text-red-400 underline"
                      onClick={() => setPubForm({ ...pubForm, image_url: '' })}
                    >
                      Retirer l&apos;image
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-2 text-sm text-stone-300">
                <input
                  type="checkbox"
                  checked={pubForm.active}
                  onChange={(e) => setPubForm({ ...pubForm, active: e.target.checked })}
                />
                Active (visible)
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-300">
                Ordre
                <input
                  type="number"
                  className="input-field w-20"
                  value={pubForm.sort_order}
                  onChange={(e) => setPubForm({ ...pubForm, sort_order: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={pubSaving} onClick={() => void savePub()}>
                {pubSaving ? '…' : pubEditing ? 'Mettre à jour' : 'Ajouter la pub'}
              </button>
              {pubEditing && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setPubEditing(null);
                    setPubForm({ title: '', body: '', link_url: '', image_url: '', active: true, sort_order: 0 });
                  }}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {pubList.length === 0 ? (
              <p className="text-sm text-stone-500">Aucune publicité pour le moment.</p>
            ) : (
              pubList.map((a) => (
                <div key={a.id} className="card flex flex-col sm:flex-row sm:items-center gap-3">
                  {a.image_url && (
                    <img src={a.image_url} alt="" className="h-14 w-14 rounded-lg object-cover border border-stone-700 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-100 truncate">
                      {a.active ? '🟢' : '⚪'} {a.title || 'Sans titre'}
                    </p>
                    <p className="text-sm text-stone-400 line-clamp-2">{a.body}</p>
                    {a.link_url && (
                      <p className="text-xs text-amber-400 truncate">{a.link_url}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setPubEditing(a.id);
                        setPubForm({
                          title: a.title || '',
                          body: a.body || '',
                          link_url: a.link_url || '',
                          image_url: a.image_url || '',
                          active: a.active,
                          sort_order: a.sort_order || 0,
                        });
                      }}
                    >
                      Modifier
                    </button>
                    <button type="button" className="btn-danger text-xs" onClick={() => void deletePub(a.id)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}


      {tab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="card space-y-3 border border-amber-500/30">
            <h2 className="text-lg font-semibold text-stone-100">Sécurité admin — 2FA</h2>
            <p className="text-xs text-stone-500">
              Double authentification pour votre compte admin (Google Authenticator, Authy…).
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={enableAdminMfa}>
                Configurer / régénérer 2FA
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={disableAdminMfa}>
                Désactiver 2FA
              </button>
            </div>
            {mfaQr && mfaSecret && (
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <p className="text-xs text-stone-400">Scannez ce QR avec votre app d&apos;authentification :</p>
                <img src={mfaQr} alt="QR 2FA" className="w-[200px] h-[200px] rounded-lg bg-white p-2" />
                <p className="text-[11px] font-mono text-stone-500 break-all">Secret : {mfaSecret}</p>
                <input
                  className="input-field font-mono"
                  placeholder="Code à 6 chiffres pour confirmer"
                  value={mfaTestCode}
                  onChange={(e) => setMfaTestCode(e.target.value)}
                  maxLength={6}
                />
                <button type="button" className="btn-primary" onClick={confirmAdminMfa}>
                  Confirmer et activer
                </button>
              </div>
            )}
          </div>
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-stone-100">WhatsApp paiements</h2>
            <p className="text-xs text-stone-500">Les clients cliquent pour vous écrire et payer (Wave / OM / MTN). Numéro par défaut : 05 02 01 20 11.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Numéro WhatsApp (ex: 22507xxxxxxxx)</label>
                <input className="input-field" value={waPhone} onChange={(e) => setWaPhone(e.target.value)} placeholder="22507xxxxxxxx" />
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setPaymentWhatsApp(waPhone);
                  flash('Numéro WhatsApp enregistré sur cet appareil admin');
                }}
              >
                Enregistrer
              </button>
            </div>
            <a className="text-sm text-emerald-400" href={paymentWhatsAppLink('Test Stock Manager')} target="_blank" rel="noreferrer">
              Tester le lien WhatsApp
            </a>
          </div>

          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-stone-100">Gestion des abonnements</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-stone-400">Durée à activer</label>
                <select className="input-field w-auto" value={subMonths} onChange={(e) => setSubMonths(Number(e.target.value))}>
                  {SUB_PERIODS.map((p) => (
                    <option key={p.months} value={p.months}>
                      {p.label} — {priceForMonths(p.months).toLocaleString('fr-FR')} F
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-stone-500">
              Offre : essai {PLAN.trialDays} j puis {PLAN.monthlyFcfa.toLocaleString('fr-FR')} F/mois. Prolongation = à partir de la date de fin actuelle si encore active.
            </p>
            {establishments.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 space-y-2">
                <p className="font-medium">Aucun établissement affiché</p>
                <p className="text-amber-100/80 text-xs">
                  Soit aucun établissement n&apos;existe encore, soit le compte connecté n&apos;a pas le rôle
                  <strong> super_admin / admin</strong> actif, soit les droits de lecture (RLS) bloquent la liste.
                </p>
                <p className="text-xs text-stone-400">
                  Vérifie l&apos;onglet Établissements. Crée un établissement ou reconnecte-toi avec le compte admin.
                </p>
                <button type="button" className="btn-secondary text-sm" onClick={() => loadData()}>
                  Recharger la liste
                </button>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-stone-500 border-b border-stone-800">
                    <th className="py-2">Établissement</th>
                    <th className="py-2">Statut</th>
                    <th className="py-2">Essai fin</th>
                    <th className="py-2">Abo fin</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {establishments.map((est) => {
                    const st = getSubscriptionState(est);
                    return (
                      <tr key={est.id} className="border-b border-stone-800/60">
                        <td className="py-2 text-stone-200">{est.name}</td>
                        <td className="py-2">
                          <span className={st.blocked ? 'text-red-400' : st.status === 'active' ? 'text-emerald-400' : 'text-amber-300'}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2 text-stone-400 text-xs">
                          {safeDateInput(est.trial_ends_at) ? new Date(est.trial_ends_at!).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="py-2 text-stone-400 text-xs">
                          {safeDateInput(est.subscription_ends_at) ? new Date(est.subscription_ends_at!).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col gap-2 min-w-[220px]">
                            <div className="flex flex-wrap gap-1">
                              <button type="button" className="text-[11px] px-2 py-1 rounded bg-emerald-600/30 text-emerald-200" onClick={() => activateSubscription(est.id, subMonths)}>
                                Activer / prolonger +{subMonths} mois
                              </button>
                              <button type="button" className="text-[11px] px-2 py-1 rounded bg-sky-600/30 text-sky-200" onClick={() => setTrialDays(est.id, 30)}>
                                Essai 30 j
                              </button>
                              <button type="button" className="text-[11px] px-2 py-1 rounded bg-sky-600/20 text-sky-300" onClick={() => setTrialDays(est.id, 7)}>
                                Essai 7 j
                              </button>
                              <button type="button" className="text-[11px] px-2 py-1 rounded bg-red-600/30 text-red-200" onClick={() => suspendSubscription(est.id)}>
                                Suspendre
                              </button>
                              <button
                                type="button"
                                className="text-[11px] px-2 py-1 rounded bg-amber-600/30 text-amber-200"
                                onClick={() => activateSubscription(est.id, 1)}
                              >
                                Réactiver 1 mois
                              </button>
                            </div>
                            <label className="text-[10px] text-stone-500 flex flex-col gap-0.5">
                              Date de fin d&apos;abonnement
                              <input
                                type="date"
                                className="text-[12px] bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-200"
                                defaultValue={safeDateInput(est.subscription_ends_at)}
                                onBlur={(e) => {
                                  if (e.target.value) setExactEndDate(est.id, e.target.value);
                                }}
                              />
                            </label>
                            <label className="text-[10px] text-stone-500 flex flex-col gap-0.5">
                              Date de fin d&apos;essai
                              <input
                                type="date"
                                className="text-[12px] bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-200"
                                defaultValue={safeDateInput(est.trial_ends_at)}
                                onBlur={(e) => {
                                  if (!e.target.value) return;
                                  const end = new Date(e.target.value);
                                  end.setHours(23, 59, 59, 999);
                                  supabase.from('establishments').update({
                                    subscription_status: 'trial',
                                    trial_ends_at: end.toISOString() }).eq('id', est.id).then(({ error: err }) => {
                                    if (err) setError(err.message);
                                    else { flash('Date d\'essai mise à jour'); loadData(); }
                                  });
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Modal open={estModal} onClose={() => setEstModal(false)} title="Nouvel établissement">
        <div className="space-y-3">
          <div>
            <label className="label">Nom</label>
            <input
              value={estForm.name}
              onChange={(e) => setEstForm({ ...estForm, name: e.target.value })}
              className="input-field"
              placeholder="Maquis Le Comptoir"
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              value={estForm.type}
              onChange={(e) => setEstForm({ ...estForm, type: e.target.value })}
              className="input-field"
            >
              <option value="maquis">Maquis</option>
                                          <option value="magasin">Magasin</option>
              <option value="boutique">Boutique</option>
              <option value="superette">Supérette</option>
                            <option value="quincaillerie">Quincaillerie</option>
                            <option value="location_event">Location événementielle</option>
            </select>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input
              value={estForm.address}
              onChange={(e) => setEstForm({ ...estForm, address: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input
              value={estForm.phone}
              onChange={(e) => setEstForm({ ...estForm, phone: e.target.value })}
              className="input-field"
            />
          </div>
          <button onClick={createEstablishment} className="btn-primary w-full">
            Créer
          </button>
        </div>
      </Modal>

      {/* Edit member */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Modifier l'accès">
        {editMember && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500 font-mono">{displayLogin(editMember.email)}</p>
            <div>
              <label className="label">Nom complet</label>
              <input
                value={memberEditForm.full_name}
                onChange={(e) => setMemberEditForm({ ...memberEditForm, full_name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Rôle</label>
              <select
                value={memberEditForm.role}
                onChange={(e) => setMemberEditForm({ ...memberEditForm, role: e.target.value as Role })}
                className="input-field"
                disabled={editMember.role === 'super_admin'}
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Établissement</label>
              <select
                value={memberEditForm.establishment_id}
                onChange={(e) => setMemberEditForm({ ...memberEditForm, establishment_id: e.target.value })}
                className="input-field"
              >
                <option value="">— Aucun —</option>
                {establishments.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Statut</label>
              <select
                value={memberEditForm.status}
                onChange={(e) =>
                  setMemberEditForm({
                    ...memberEditForm,
                    status: e.target.value as 'active' | 'suspended' })
                }
                className="input-field"
                disabled={editMember.role === 'super_admin'}
              >
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
              </select>
            </div>
            <button
              onClick={saveMemberEdit}
              disabled={actionLoading === editMember.id}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {actionLoading === editMember.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Enregistrer
            </button>
            {editMember.role !== 'super_admin' && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toggleSuspend(editMember)}
                  className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
                >
                  <Ban size={14} /> {editMember.status === 'active' ? 'Suspendre' : 'Réactiver'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMember(editMember)}
                  className="btn-ghost text-sm text-red-400 flex items-center gap-1"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit establishment */}
      <Modal open={!!editEst} onClose={() => setEditEst(null)} title="Modifier l'établissement">
        {editEst && (
          <div className="space-y-3">
            <div>
              <label className="label">Nom</label>
              <input
                value={estEditForm.name}
                onChange={(e) => setEstEditForm({ ...estEditForm, name: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={estEditForm.type}
                onChange={(e) => setEstEditForm({ ...estEditForm, type: e.target.value })}
                className="input-field"
              >
                <option value="maquis">Maquis</option>
                                                <option value="magasin">Magasin</option>
              </select>
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                value={estEditForm.address}
                onChange={(e) => setEstEditForm({ ...estEditForm, address: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input
                value={estEditForm.phone}
                onChange={(e) => setEstEditForm({ ...estEditForm, phone: e.target.value })}
                className="input-field"
              />
            </div>
            <button
              onClick={saveEstEdit}
              disabled={actionLoading === editEst.id || !estEditForm.name.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {actionLoading === editEst.id ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              Enregistrer
            </button>

            <div className="pt-2 border-t border-stone-800">
              <p className="text-sm font-medium text-stone-200 mb-2">
                Membres rattachés ({estMembers.length})
              </p>
              {estMembers.length === 0 ? (
                <p className="text-xs text-stone-500">Aucun membre. Créez un accès ou assignez un membre existant.</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {estMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between text-sm bg-stone-800/50 rounded-lg px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-stone-200 truncate">{m.full_name || displayLogin(m.email)}</p>
                        <p className="text-xs text-stone-500">{ROLE_LABELS[m.role]}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-xs text-amber-400 hover:underline px-1"
                          onClick={() => {
                            setEditEst(null);
                            openEditMember(m);
                          }}
                        >
                          Éditer
                        </button>
                        {m.role !== 'super_admin' && (
                          <button
                            type="button"
                            className="text-xs text-red-400 hover:underline px-1"
                            onClick={() => removeMemberFromEst(m)}
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => deleteEstablishment(editEst)}
              className="btn-ghost w-full text-sm text-red-400 flex items-center justify-center gap-1"
            >
              <Trash2 size={14} /> Supprimer l&apos;établissement
            </button>
          </div>
        )}
      </Modal>

      <Modal open={memberModal} onClose={() => setMemberModal(false)} title="Créer un accès direct">
        <DirectAccessForm
          establishments={establishments}
          onDone={() => {
            setMemberModal(false);
            loadData();
          }}
        />
      </Modal>
    </div>
  );
}


function DirectAccessForm({ establishments, onDone }: { establishments: Establishment[]; onDone: () => void }) {
  const { member } = useAuth();
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<Role>('owner');
  const [estId, setEstId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function autoGenerate() {
    const newLogin = generateLogin(fullName || role, role);
    const newPass = generatePassword();
    setLogin(newLogin);
    setPassword(newPass);
  }

  async function copyCredentials() {
    if (!created) return;
    const text = `Identifiant: ${created.login}\nMot de passe: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function submit() {
    if (!login.trim() || !password || !estId || !member) {
      setError('Identifiant, mot de passe et établissement sont obligatoires');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authEmail = toAuthEmail(login);

      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData.session;
      if (!adminSession) {
        setError('Session administrateur invalide. Reconnectez-vous.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: authEmail,
        password,
        options: { data: { full_name: fullName, login: login.trim() } } });

      if (signUpError) {
        setError(
          signUpError.message.includes('already') || signUpError.message.includes('registered')
            ? 'Cet identifiant est déjà utilisé'
            : signUpError.message
        );
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token });
        setLoading(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token });

      if (data.user) {
        const { data: existing } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        const payload = {
          full_name: fullName || null,
          role,
          establishment_id: estId,
          status: 'active' as const,
          email: authEmail };

        if (existing) {
          const { error: updateError } = await supabase.from('members').update(payload).eq('user_id', data.user.id);
          if (updateError) {
            setError(updateError.message);
            setLoading(false);
            return;
          }
        } else {
          const { error: insertError } = await supabase.from('members').insert({
            user_id: data.user.id,
            ...payload });
          if (insertError) {
            setError(insertError.message);
            setLoading(false);
            return;
          }
        }
      }

      // Restaurer encore la session admin (signUp peut la réécraser via onAuthStateChange)
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token });

      setCreated({ login: login.trim().includes('@') ? login.trim() : login.trim().toLowerCase(), password });
    } catch (e: any) {
      setError(e?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className="bg-success-500/10 border border-success-500/30 rounded-xl p-4 text-center">
          <CheckCircle2 className="mx-auto text-success-400 mb-2" size={28} />
          <p className="text-success-300 font-semibold">Compte créé avec succès</p>
          <p className="text-sm text-stone-400 mt-1">Notez ou copiez ces identifiants pour les transmettre</p>
        </div>
        <div className="bg-stone-800 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Identifiant</p>
            <p className="text-lg font-mono font-bold text-primary-300">{created.login}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide">Mot de passe</p>
            <p className="text-lg font-mono font-bold text-amber-300">{created.password}</p>
          </div>
        </div>
        <button onClick={copyCredentials} className="btn-secondary w-full flex items-center justify-center gap-2">
          {copied ? <><Check size={18} /> Copié !</> : <><Copy size={18} /> Copier identifiant + mot de passe</>}
        </button>
        <button
          onClick={async () => {
            // Recharge la page pour restaurer proprement la session Super Admin
            onDone();
            window.location.href = '/admin';
          }}
          className="btn-primary w-full"
        >
          Terminé
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-error-500/10 border border-error-500/30 rounded-xl p-3 text-sm text-error-300">{error}</div>
      )}

      <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3 text-xs text-primary-200">
        Créez un <strong>login simple</strong> (ex: gerant01) ou un email. Un mot de passe est généré automatiquement.
      </div>

      <div>
        <label className="label">Nom complet</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input-field"
          placeholder="Jean Kouassi"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Identifiant (login)</label>
          <button type="button" onClick={autoGenerate} className="text-xs text-primary-400 flex items-center gap-1 hover:text-primary-300">
            <RefreshCw size={12} /> Générer login + mot de passe
          </button>
        </div>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className="input-field font-mono"
          placeholder="ex: gerant01 ou jean@gmail.com"
          autoComplete="off"
        />
        <p className="text-xs text-stone-500 mt-1">
          Pas besoin d&apos;email réel — un simple nom suffit.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Mot de passe</label>
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="text-xs text-primary-400 flex items-center gap-1 hover:text-primary-300"
          >
            <RefreshCw size={12} /> Régénérer
          </button>
        </div>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field font-mono"
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="label">Rôle</label>
        <p className="text-xs text-stone-500 mb-1">Super Admin → Admin → Propriétaire → Gérant → Caissier → Employé</p>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input-field">
          {(['admin', 'owner', 'manager', 'cashier', 'employee'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="label">Établissement</label>
        <select value={estId} onChange={(e) => setEstId(e.target.value)} className="input-field">
          <option value="">— Choisir —</option>
          {establishments.map((est) => (
            <option key={est.id} value={est.id}>
              {est.name}
            </option>
          ))}
        </select>
      </div>

      <button onClick={submit} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Créer le compte
      </button>




    </div>
  );
}
