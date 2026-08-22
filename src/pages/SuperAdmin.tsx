import { useEffect, useState } from 'react';
import {
  UserCog, Building2, Users, Plus, Check, X, Loader2, Ban, KeyRound, Trash2, Clock, Mail,
  RefreshCw, Copy, CheckCircle2, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Member, Establishment, AccessRequest, Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';
import { Modal, Badge, EmptyState } from '@/components/ui';
import { toAuthEmail, displayLogin, generatePassword, generateLogin } from '@/lib/login';

type Tab = 'requests' | 'members' | 'establishments';

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

  const [approveModal, setApproveModal] = useState<AccessRequest | null>(null);
  const [estModal, setEstModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editEst, setEditEst] = useState<Establishment | null>(null);

  const [estForm, setEstForm] = useState({ name: '', type: 'maquis', address: '', phone: '' });
  const [approveForm, setApproveForm] = useState<{ role: Role; establishmentId: string }>({
    role: 'employee',
    establishmentId: '',
  });
  const [memberEditForm, setMemberEditForm] = useState({
    full_name: '',
    role: 'employee' as Role,
    establishment_id: '',
    status: 'active' as 'active' | 'suspended',
  });
  const [estEditForm, setEstEditForm] = useState({
    name: '',
    type: 'maquis',
    address: '',
    phone: '',
  });

  async function loadData() {
    const [reqRes, memRes, estRes] = await Promise.all([
      supabase.from('access_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('establishments').select('*').order('created_at', { ascending: false }),
    ]);
    setRequests((reqRes.data ?? []) as AccessRequest[]);
    setMembers((memRes.data ?? []) as Member[]);
    setEstablishments((estRes.data ?? []) as Establishment[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2500);
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
          status: 'active',
        },
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
        establishment_id: memberEditForm.establishment_id || null,
      };
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
            status: 'active',
          },
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

  async function markSubscriptionPaid(estId: string) {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'active',
      subscription_ends_at: end.toISOString(),
      last_payment_at: new Date().toISOString(),
    }).eq('id', estId);
    if (err) setError(err.message);
    else {
      flash('Abonnement activé 30 jours (10 000 F)');
      await loadData();
    }
  }

  async function suspendSubscription(estId: string) {
    const { error: err } = await supabase.from('establishments').update({
      subscription_status: 'suspended',
    }).eq('id', estId);
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
      trial_ends_at: trialEnd.toISOString(),
    });
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
          phone: estEditForm.phone || null,
        })
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
      status: m.status === 'suspended' ? 'suspended' : 'active',
    });
  }

  function openEditEst(est: Establishment) {
    setError(null);
    setEditEst(est);
    setEstEditForm({
      name: est.name,
      type: est.type || 'maquis',
      address: est.address || '',
      phone: est.phone || '',
    });
  }

  if (member?.role !== 'super_admin') {
    return (
      <EmptyState
        icon={<UserCog size={48} />}
        title="Accès refusé"
        message="Cette section est réservée au Super Administrateur."
      />
    );
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
                            <button type="button" className="text-[11px] px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200" onClick={() => markSubscriptionPaid(est.id)}>Activer 30j (10k)</button>
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
                    status: e.target.value as 'active' | 'suspended',
                  })
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
        options: { data: { full_name: fullName, login: login.trim() } },
      });

      if (signUpError) {
        setError(
          signUpError.message.includes('already') || signUpError.message.includes('registered')
            ? 'Cet identifiant est déjà utilisé'
            : signUpError.message
        );
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        setLoading(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

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
          email: authEmail,
        };

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
            ...payload,
          });
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
        refresh_token: adminSession.refresh_token,
      });

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
