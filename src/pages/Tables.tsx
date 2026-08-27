import { useEffect, useState } from 'react';
import { LayoutGrid, Plus, Trash2, Users, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { RestaurantTable } from '@/lib/types';
import { Modal, EmptyState, Badge } from '@/components/ui';

export default function Tables() {
  const { member } = useAuth();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ number: '', seats: '4', location: 'salle' });

  async function load() {
    if (!member?.establishment_id) { setLoading(false); return; }
    const { data } = await supabase.from('restaurant_tables').select('*').eq('establishment_id', member.establishment_id).order('number');
    setTables((data ?? []) as RestaurantTable[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [member]);

  async function save() {
    if (!member?.establishment_id || !form.number) return;
    await supabase.from('restaurant_tables').insert({
      establishment_id: member.establishment_id,
      number: form.number,
      seats: Number(form.seats) || 4,
      location: form.location,
    });
    setModalOpen(false);
    setForm({ number: '', seats: '4', location: 'salle' });
    await load();
  }

  async function remove(t: RestaurantTable) {
    if (!confirm(`Supprimer la table ${t.number} ?`)) return;
    await supabase.from('restaurant_tables').delete().eq('id', t.id);
    await load();
  }

  async function cycleStatus(t: RestaurantTable) {
    const next: Record<string, string> = { free: 'occupied', occupied: 'reserved', reserved: 'free' };
    await supabase.from('restaurant_tables').update({ status: next[t.status] }).eq('id', t.id);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-stone-400">Chargement...</div>;
  if (!member?.establishment_id) return <EmptyState icon={<LayoutGrid size={48} />} title="Aucun établissement" message="Vous n'êtes rattaché à aucun établissement." />;

  const free = tables.filter((t) => t.status === 'free').length;
  const occupied = tables.filter((t) => t.status === 'occupied').length;
  const reserved = tables.filter((t) => t.status === 'reserved').length;
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-stone-100">Tables</h1>
          <p className="text-stone-400 text-sm">{tables.length} tables · {totalSeats} places · {free} libres</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Ajouter</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card flex items-center gap-3">
          <CheckCircle2 size={20} className="text-success-400" />
          <div><p className="text-sm text-stone-400">Libres</p><p className="text-xl font-bold text-stone-100">{free}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <Users size={20} className="text-error-400" />
          <div><p className="text-sm text-stone-400">Occupées</p><p className="text-xl font-bold text-stone-100">{occupied}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <Calendar size={20} className="text-warning-400" />
          <div><p className="text-sm text-stone-400">Réservées</p><p className="text-xl font-bold text-stone-100">{reserved}</p></div>
        </div>
      </div>

      {tables.length === 0 ? (
        <EmptyState icon={<LayoutGrid size={48} />} title="Aucune table" message="Ajoutez vos tables." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => cycleStatus(t)}
              className={`relative card text-center transition-all hover:scale-105 active:scale-95 ${
                t.status === 'free' ? 'border-success-500/30 bg-success-500/5' :
                t.status === 'occupied' ? 'border-error-500/30 bg-error-500/5' :
                'border-warning-500/30 bg-warning-500/5'
              }`}
            >
              <div className="absolute top-2 right-2">
                <button onClick={(e) => { e.stopPropagation(); remove(t); }} className="text-stone-500 hover:text-error-400">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="text-3xl font-bold font-display text-stone-100 mb-1">{t.number}</div>
              <div className="flex items-center justify-center gap-1 text-sm text-stone-400 mb-2">
                <Users size={12} /> {t.seats}
              </div>
              <Badge color={t.status === 'free' ? 'success' : t.status === 'occupied' ? 'error' : 'warning'}>
                {t.status === 'free' ? 'Libre' : t.status === 'occupied' ? 'Occupée' : 'Réservée'}
              </Badge>
              <p className="text-xs text-stone-500 mt-2">{t.location}</p>
            </button>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle table">
        <div className="space-y-3">
          <div>
            <label className="label">Numéro / Nom</label>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="input-field" placeholder="T1 ou Terrasse A" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Places</label>
              <input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label">Zone</label>
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field">
                <option value="salle">Salle</option>
                <option value="terrasse">Terrasse</option>
                <option value="vip">VIP</option>
                <option value="exterieur">Extérieur</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-stone-500">Cliquez sur une table pour changer son statut (Libre → Occupée → Réservée)</p>
          <button onClick={save} className="btn-primary w-full">Ajouter</button>
        </div>
      </Modal>
    </div>
  );
}
