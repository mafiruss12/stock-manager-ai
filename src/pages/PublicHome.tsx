import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, ChevronRight, Loader2, UtensilsCrossed,
  Wine, ArrowRight, Flame, Leaf, Music, Sandwich, Star
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';
import { slugify, isOpenNow, type OpeningHours } from '@/lib/publicEstablishment';

type PubEst = {
  id: string;
  name: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  logo_url?: string | null;
  public_menu?: boolean;
  opening_hours?: OpeningHours | null;
  is_sponsored?: boolean | null;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  stock: number;
  establishment_id: string;
  image_url?: string | null;
  est_name?: string;
};

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed, active: true },
  { id: 'maquis', label: 'Maquis', icon: Leaf, active: false },
  { id: 'bar', label: 'Bars', icon: Wine, active: false },
  { id: 'lounge', label: 'Lounges', icon: Music, active: false },
  { id: 'fastfood', label: 'Fast-foods', icon: Sandwich, active: false },
];

export default function PublicHome() {
  useEffect(() => {
    document.title = 'CHEZ NOUS — Découvrez les meilleurs établissements';
  }, []);

  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [q, setQ] = useState('');
  const [where, setWhere] = useState('Abidjan');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('establishments')
        .select('id, name, type, address, phone, logo_url, public_menu, opening_hours, is_sponsored')
        .eq('public_menu', true)
        .order('name')
        .limit(48);

      if (cancelled) return;
      const list = (data as PubEst[]) || [];
      setEsts(list);

      if (list.length) {
        const ids = list.map((e) => e.id);
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, price, stock, establishment_id, image_url')
          .in('establishment_id', ids)
          .gt('price', 0)
          .order('name')
          .limit(24);
        if (!cancelled && prods) {
          const byId = Object.fromEntries(list.map((e) => [e.id, e.name]));
          setMenuItems(
            (prods as MenuItem[]).map((p) => ({
              ...p,
              est_name: byId[p.establishment_id],
            }))
          );
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredEsts = useMemo(() => {
    let list = ests;
    const s = q.trim().toLowerCase();
    const w = where.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          String(e.type || '').toLowerCase().includes(s) ||
          String(e.address || '').toLowerCase().includes(s)
      );
    }
    if (w && w !== 'abidjan') {
      list = list.filter((e) => String(e.address || '').toLowerCase().includes(w));
    }
    return [...list].sort((a, b) => Number(!!b.is_sponsored) - Number(!!a.is_sponsored));
  }, [ests, q, where]);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  const rightSlot = user ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.location.assign('/dashboard')}
        className="h-10 px-3 rounded-xl text-sm font-semibold bg-[#FFF0D6] text-[#C2410C] hover:bg-[#FFE4B8] transition"
      >
        Mon espace
      </button>
      <button type="button" onClick={() => void signOut()} className="text-xs text-[#8A7B6B] hover:text-[#2C2416]">
        Quitter
      </button>
    </div>
  ) : null;

  return (
    <PublicLayout onOpenAuth={user ? undefined : openAuth} rightSlot={rightSlot}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />

      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=75)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FBF7F0] via-[#FBF7F0]/92 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FBF7F0] via-transparent to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 py-14 sm:py-20">
          <div className="max-w-xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-[#2C2416] leading-[1.15] tracking-tight">
              Découvrez les{' '}
              <span className="text-[#E85D04] italic font-serif">meilleurs</span>
              <br />
              <span className="text-[#E85D04] italic font-serif">établissements</span>
            </h1>

            <p className="mt-4 text-[#6B5E4F] text-base sm:text-lg max-w-md leading-relaxed">
              Plongez au cœur de la scène culinaire ivoirienne.
              Saveurs authentiques, ambiance chaleureuse et expériences inoubliables.
            </p>

            {/* Search */}
            <div className="mt-8 flex flex-col sm:flex-row gap-2 max-w-lg">
              <div className="flex-1 relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[#8A7B6B]">
                  <MapPin size={16} className="text-[#E85D04]" />
                  <span className="text-sm font-medium hidden sm:inline">Abidjan</span>
                  <span className="text-[#D6CBB8]">|</span>
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un établissement, un plat..."
                  className="w-full h-12 rounded-xl bg-white border border-[#E8DFD0] pl-28 sm:pl-32 pr-4 text-sm text-[#2C2416] placeholder:text-[#A89880] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/25 focus:border-[#E85D04] shadow-sm"
                />
              </div>
              <Link
                to={`/establishments${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                className="h-12 px-5 rounded-xl bg-[#E85D04] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-orange-600/20 shrink-0"
              >
                <Search size={18} />
              </Link>
            </div>

            {/* Spot du moment */}
            <div className="mt-6 inline-flex items-start gap-3 bg-white/90 backdrop-blur rounded-2xl border border-[#E8DFD0] p-3.5 shadow-sm max-w-xs">
              <div className="w-10 h-10 rounded-full bg-[#FFF0D6] flex items-center justify-center text-[#E85D04] shrink-0">
                <Flame size={18} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#E85D04] uppercase tracking-wide">Le spot du moment</p>
                <p className="font-bold text-sm text-[#2C2416]">Chez Mama Africa</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={11} className="fill-[#E85D04] text-[#E85D04]" />)}
                  <span className="text-xs text-[#6B5E4F] ml-1">4.8</span>
                </div>
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ouvert
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 space-y-12 pb-16">
        {/* Categories */}
        <section className="-mt-2">
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/establishments?type=${c.id}`}
                  className={`flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition ${
                    c.active
                      ? 'bg-[#E85D04] text-white shadow-sm'
                      : 'bg-white border border-[#E8DFD0] text-[#6B5E4F] hover:border-[#E85D04]/40 hover:text-[#E85D04]'
                  }`}
                >
                  <Icon size={16} />
                  {c.label}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Établissements populaires */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-6">
            <h2 className="text-2xl font-bold text-[#2C2416]">Établissements populaires</h2>
            <Link to="/establishments" className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1">
              Voir tout <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[#E85D04]" size={28} />
            </div>
          ) : filteredEsts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E8DFD0] bg-white p-12 text-center">
              <p className="font-semibold text-[#2C2416]">Aucune vitrine publique pour le moment</p>
              <p className="text-sm text-[#8A7B6B] mt-2 max-w-md mx-auto">
                Les établissements apparaîtront ici dès qu&apos;un propriétaire active le menu public.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {filteredEsts.slice(0, 5).map((est) => {
                const open = isOpenNow(est.opening_hours) === true;
                return (
                  <Link
                    key={est.id}
                    to={`/e/${slugify(est.name, est.id)}`}
                    className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-[#E85D04]/25 transition group"
                  >
                    <div className="h-36 bg-[#F7F0E6] relative overflow-hidden">
                      {est.logo_url ? (
                        <img src={est.logo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                          <UtensilsCrossed size={32} />
                        </div>
                      )}
                      <span className="absolute top-2.5 left-2.5 text-[10px] font-bold bg-white/95 text-[#2C2416] px-2 py-0.5 rounded-md capitalize shadow-sm">
                        {est.type || 'Établissement'}
                      </span>
                    </div>
                    <div className="p-3.5">
                      <p className="font-bold text-sm text-[#2C2416] truncate">{est.name}</p>
                      {est.address && (
                        <p className="mt-1 text-[11px] text-[#8A7B6B] flex items-center gap-1 truncate">
                          <MapPin size={11} className="text-[#E85D04] shrink-0" />
                          {est.address}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${open ? 'text-emerald-700' : 'text-[#A89880]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#D6CBB8]'}`} />
                          {open ? 'Ouvert' : '—'}
                        </span>
                        <span className="text-xs font-medium text-[#6B5E4F] flex items-center gap-0.5">
                          <Star size={12} className="fill-[#E85D04] text-[#E85D04]" />
                          4.6
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* CTA Propriétaire */}
        <section className="rounded-3xl bg-gradient-to-br from-[#E85D04] to-[#9a3412] p-8 sm:p-11 text-center text-white relative overflow-hidden">
          <h2 className="text-2xl sm:text-3xl font-bold relative z-10">Vous êtes propriétaire ?</h2>
          <p className="mt-3 text-white/85 max-w-md mx-auto relative z-10">
            Créez votre vitrine gratuite, publiez votre menu et attirez plus de clients dès aujourd&apos;hui.
          </p>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            className="mt-6 inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-[#C2410C] font-bold text-sm hover:bg-[#FFF0D6] transition shadow-lg relative z-10"
          >
            Créer mon établissement
            <ArrowRight size={18} />
          </button>
        </section>
      </div>
    </PublicLayout>
  );
}
