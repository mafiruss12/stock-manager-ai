import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Star, ChevronRight, Loader2, UtensilsCrossed,
  Beer, Wine, Calendar, ArrowRight, Flame, Leaf, Music, Sandwich
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

type Ann = {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  image_url: string | null;
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
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed, color: 'bg-[#E85D04] text-white' },
  { id: 'maquis', label: 'Maquis', icon: Leaf, color: 'bg-[#166534] text-white' },
  { id: 'bar', label: 'Bars', icon: Wine, color: 'bg-[#7c2d12] text-white' },
  { id: 'lounge', label: 'Lounges', icon: Music, color: 'bg-[#9a3412] text-white' },
  { id: 'fastfood', label: 'Fast-foods', icon: Sandwich, color: 'bg-[#c2410c] text-white' },
];

export default function PublicHome() {
  useEffect(() => {
    document.title = 'Stock Manager — Découvrez les meilleurs établissements';
  }, []);

  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [q, setQ] = useState('');
  const [where, setWhere] = useState('');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [eRes, aRes] = await Promise.all([
        supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, public_menu, opening_hours, is_sponsored')
          .eq('public_menu', true)
          .order('name')
          .limit(48),
        supabase
          .from('app_announcements')
          .select('id, title, body, link_url, image_url')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .limit(8),
      ]);
      if (cancelled) return;
      const list = (eRes.data as PubEst[]) || [];
      setEsts(list);
      setAnns((aRes.data as Ann[]) || []);

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
    return () => {
      cancelled = true;
    };
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
    if (w) {
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
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-xs text-[#8A7B6B] hover:text-[#2C2416]"
      >
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
            backgroundImage:
              'url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=70)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2C2416]/90 via-[#2C2416]/70 to-[#E85D04]/40" />

        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-[#FDBA74] text-xs font-semibold uppercase tracking-widest mb-4">
              <Flame size={14} />
              Le meilleur de la Côte d&apos;Ivoire
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
              Découvrez les{' '}
              <span className="text-[#FDBA74]">meilleurs</span>{' '}
              établissements
            </h1>

            <p className="mt-5 text-white/80 text-base sm:text-lg max-w-lg leading-relaxed">
              Restaurants, maquis, bars et fast-foods authentiques pour des moments savoureux près de chez vous.
            </p>

            {/* Search box */}
            <div className="mt-8 bg-white rounded-2xl p-2 sm:p-3 shadow-2xl shadow-black/20">
              <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89880]" size={18} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Rechercher un établissement, un plat..."
                    className="w-full h-12 rounded-xl bg-[#FBF7F0] border border-[#E8DFD0] pl-11 pr-3 text-sm text-[#2C2416] placeholder:text-[#A89880] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/30 focus:border-[#E85D04]"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A89880]" size={18} />
                  <input
                    value={where}
                    onChange={(e) => setWhere(e.target.value)}
                    placeholder="Abidjan, Cocody, Yopougon..."
                    className="w-full h-12 rounded-xl bg-[#FBF7F0] border border-[#E8DFD0] pl-11 pr-3 text-sm text-[#2C2416] placeholder:text-[#A89880] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/30 focus:border-[#E85D04]"
                  />
                </div>
                <Link
                  to={`/establishments${q || where ? `?q=${encodeURIComponent(q)}&where=${encodeURIComponent(where)}` : ''}`}
                  className="h-12 px-6 rounded-xl bg-[#E85D04] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-orange-600/20"
                >
                  Rechercher
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 space-y-14 py-12">
        {/* ========== CATEGORIES ========== */}
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/establishments?type=${c.id}`}
                  className={`flex items-center gap-2.5 shrink-0 px-5 py-3 rounded-full font-semibold text-sm transition hover:scale-105 ${c.color} shadow-sm`}
                >
                  <Icon size={18} />
                  {c.label}
                </Link>
              );
            })}
          </div>
        </section>

        {/* ========== OPEN NOW ========== */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2416]">Ouvert maintenant</h2>
              <p className="text-sm text-[#8A7B6B] mt-1">Établissements disponibles à cette heure</p>
            </div>
            <Link
              to="/establishments"
              className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1 transition"
            >
              Voir tout <ChevronRight size={16} />
            </Link>
          </div>

          {(() => {
            const openList = filteredEsts.filter((e) => isOpenNow(e.opening_hours) === true).slice(0, 6);
            if (loading) {
              return (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-[#E85D04]" size={28} />
                </div>
              );
            }
            if (openList.length === 0) {
              return (
                <div className="rounded-2xl border border-dashed border-[#E8DFD0] bg-white p-8 text-center text-sm text-[#8A7B6B]">
                  Aucun établissement n&apos;a encore renseigné d&apos;horaires, ou aucun n&apos;est ouvert à cette heure.
                </div>
              );
            }
            return (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {openList.map((est) => (
                  <Link
                    key={est.id}
                    to={`/e/${slugify(est.name, est.id)}`}
                    className="rounded-2xl border border-[#E8DFD0] bg-white p-4 hover:shadow-lg hover:border-[#E85D04]/30 transition flex gap-3 group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-[#F7F0E6] overflow-hidden shrink-0">
                      {est.logo_url ? (
                        <img src={est.logo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                          <UtensilsCrossed size={22} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[#2C2416] truncate">{est.name}</p>
                      <p className="text-[11px] text-[#8A7B6B] capitalize mt-0.5">{est.type || 'Établissement'}</p>
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Ouvert
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()}
        </section>

        {/* ========== DISCOVER ========== */}
        <section id="discover">
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2416]">Établissements populaires</h2>
              <p className="text-sm text-[#8A7B6B] mt-1">Vitrines publiques activées par les propriétaires</p>
            </div>
            <Link
              to="/establishments"
              className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1 transition"
            >
              Tout voir <ChevronRight size={16} />
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
                Les établissements apparaîtront ici dès qu&apos;un propriétaire active le menu public dans Stock Manager.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredEsts.slice(0, 6).map((est) => (
                <Link
                  key={est.id}
                  to={`/e/${slugify(est.name, est.id)}`}
                  className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden shadow-sm hover:shadow-xl hover:border-[#E85D04]/20 transition group"
                >
                  <div className="h-44 bg-[#F7F0E6] relative overflow-hidden">
                    {est.logo_url ? (
                      <img
                        src={est.logo_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                        <UtensilsCrossed size={40} />
                      </div>
                    )}
                    {est.is_sponsored && (
                      <span className="absolute top-3 left-3 text-[10px] font-bold bg-[#E85D04] text-white px-2 py-1 rounded-full">
                        Sponsorisé
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#2C2416] truncate">{est.name}</p>
                        <p className="text-xs text-[#8A7B6B] capitalize mt-0.5">{est.type || 'Établissement'}</p>
                      </div>
                    </div>
                    {est.address && (
                      <p className="mt-2 text-xs text-[#8A7B6B] flex items-center gap-1 truncate">
                        <MapPin size={12} className="shrink-0 text-[#E85D04]" />
                        {est.address}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      {isOpenNow(est.opening_hours) === true ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Ouvert
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-[#A89880]">Horaires non renseignés</span>
                      )}
                      <span className="text-xs font-semibold text-[#E85D04] group-hover:underline">
                        Voir →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ========== MENU ITEMS (if any) ========== */}
        {menuItems.length > 0 && (
          <section>
            <div className="flex items-end justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#2C2416]">Plats à découvrir</h2>
                <p className="text-sm text-[#8A7B6B] mt-1">Sélection de plats disponibles</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {menuItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden hover:shadow-md transition"
                >
                  <div className="h-32 bg-[#F7F0E6]">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                        <UtensilsCrossed size={28} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-sm text-[#2C2416] truncate">{item.name}</p>
                    <p className="text-xs text-[#8A7B6B] mt-0.5 truncate">{item.est_name}</p>
                    <p className="mt-2 font-bold text-[#E85D04]">
                      {item.price.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========== CTA ========== */}
        <section className="rounded-3xl bg-gradient-to-br from-[#E85D04] to-[#9a3412] p-8 sm:p-12 text-center text-white overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Vous êtes propriétaire ?</h2>
            <p className="mt-3 text-white/85 max-w-lg mx-auto">
              Créez votre vitrine gratuite, publiez votre menu et attirez plus de clients dès aujourd&apos;hui.
            </p>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="mt-6 inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-[#C2410C] font-bold text-sm hover:bg-[#FFF0D6] transition shadow-lg"
            >
              Créer mon établissement
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
