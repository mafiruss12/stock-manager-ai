import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MapPin, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';

type PubEst = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  logo_url?: string | null;
};

export default function PublicEstablishments() {
  const { user, signOut } = useAuth();
  const [params] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [loading, setLoading] = useState(true);
  const type = params.get('type') || '';
  const q = params.get('q') || '';
  const where = params.get('where') || '';

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('establishments')
        .select('id, name, type, address, phone, logo_url')
        .eq('public_menu', true)
        .order('name')
        .limit(80);
      setEsts((data as PubEst[]) || []);
      setLoading(false);
    })();
  }, []);

  const list = useMemo(() => {
    let l = ests;
    if (type) l = l.filter((e) => String(e.type || '').toLowerCase().includes(type.toLowerCase()));
    if (q) {
      const s = q.toLowerCase();
      l = l.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          String(e.type || '').toLowerCase().includes(s) ||
          String(e.address || '').toLowerCase().includes(s)
      );
    }
    if (where) {
      const w = where.toLowerCase();
      l = l.filter((e) => String(e.address || '').toLowerCase().includes(w));
    }
    return l;
  }, [ests, type, q, where]);

  return (
    <PublicLayout
      onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}
      rightSlot={
        user ? (
          <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => window.location.assign('/dashboard')}>
            Mon espace
          </button>
        ) : undefined
      }
    >
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Établissements</h1>
        <p className="text-sm text-slate-500 mt-1">Vitrines publiques — menus et contacts</p>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : list.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 text-sm">
            Aucun établissement public pour ces filtres.
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((est) => (
              <Link key={est.id} to={`/m/${est.id}`} className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition">
                <div className="h-36 bg-slate-100 flex items-center justify-center">
                  {est.logo_url ? <img src={est.logo_url} alt="" className="w-full h-full object-cover" /> : <UtensilsCrossed className="text-slate-300" size={32} />}
                </div>
                <div className="p-4">
                  <p className="font-bold">{est.name}</p>
                  <p className="text-xs text-slate-500 capitalize mt-0.5">{est.type}</p>
                  {est.address && <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin size={12} />{est.address}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
