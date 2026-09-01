import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, ChevronRight, Loader2, UtensilsCrossed,
  Wine, ArrowRight, Flame, Leaf, Music, Sandwich, Star,
  Camera, Sparkles, Users, Mic2
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

const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed },
  { id: 'maquis', label: 'Maquis', icon: Leaf },
  { id: 'bar', label: 'Bars', icon: Wine },
  { id: 'lounge', label: 'Lounges', icon: Music },
  { id: 'fastfood', label: 'Fast-foods', icon: Sandwich },
];

const SERVICES = [
  { icon: Mic2, title: 'DJ & Animation', desc: 'Ambiance garantie pour vos soirées', color: 'from-purple-500 to-pink-500' },
  { icon: Camera, title: 'Photographe', desc: 'Capturez vos meilleurs moments', color: 'from-blue-500 to-cyan-500' },
  { icon: Users, title: 'Traiteur', desc: 'Cuisine pour événements privés', color: 'from-orange-500 to-amber-500' },
  { icon: Sparkles, title: 'Décoration', desc: 'Mise en scène élégante', color: 'from-emerald-500 to-teal-500' },
];

const HERO_IMAGES = [
  '/hero-dame.jpg',
  '/hero-groupe.jpg',
  '/hero-maquis.jpg',
];

export default function PublicHome() {
  useEffect(() => {
    document.title = 'CHEZ NOUS — Découvrez les meilleurs établissements';
  }, []);

  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [q, setQ] = useState('');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  // Auto-rotate hero images
  useEffect(() => {
    const t = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

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
      if (!cancelled) {
        setEsts((data as PubEst[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredEsts = useMemo(() => {
    let list = ests;
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          String(e.type || '').toLowerCase().includes(s) ||
          String(e.address || '').toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => Number(!!b.is_sponsored) - Number(!!a.is_sponsored));
  }, [ests, q]);

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

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-fade-up {
          animation: fadeUp 0.7s ease-out both;
        }
        .animate-fade-up-delay-1 { animation-delay: 0.15s; }
        .animate-fade-up-delay-2 { animation-delay: 0.3s; }
        .animate-fade-up-delay-3 { animation-delay: 0.45s; }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .hero-img {
          transition: opacity 1.2s ease-in-out;
        }
      `}</style>

      {/* ========== HERO ========== */}
      <section className="relative bg-[#FBF7F0] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center py-12 lg:py-16">
            
            {/* Left */}
            <div className="relative z-10 order-2 lg:order-1">
              <h1 className="animate-fade-up text-[2.5rem] sm:text-5xl font-bold text-[#2C2416] leading-[1.12] tracking-tight">
                Découvrez les{' '}
                <span className="text-[#E85D04]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600 }}>
                  meilleurs
                </span>
                <br />
                <span className="text-[#E85D04]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 600 }}>
                  établissements
                </span>
              </h1>

              <p className="animate-fade-up animate-fade-up-delay-1 mt-5 text-[#6B5E4F] text-base sm:text-[17px] max-w-md leading-relaxed">
                Plongez au cœur de la scène culinaire ivoirienne.
                Saveurs authentiques, ambiance chaleureuse et expériences inoubliables.
              </p>

              {/* Search */}
              <div className="animate-fade-up animate-fade-up-delay-2 mt-8 flex items-center bg-white rounded-2xl border border-[#E8DFD0] shadow-sm overflow-hidden max-w-md">
                <div className="flex items-center gap-2 pl-4 pr-3 text-[#8A7B6B] border-r border-[#E8DFD0] shrink-0">
                  <MapPin size={16} className="text-[#E85D04]" />
                  <span className="text-sm font-medium">Abidjan</span>
                </div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Établissement, plat, ambiance..."
                  className="flex-1 h-12 px-3 text-sm text-[#2C2416] placeholder:text-[#A89880] focus:outline-none bg-transparent min-w-0"
                />
                <Link
                  to={`/establishments${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                  className="h-12 w-12 flex items-center justify-center bg-[#E85D04] hover:bg-[#C2410C] text-white transition shrink-0"
                >
                  <Search size={18} />
                </Link>
              </div>

              {/* Spot du moment - floating */}
              <div className="animate-fade-up animate-fade-up-delay-3 animate-float mt-7 inline-flex items-start gap-3 bg-white rounded-2xl border border-[#E8DFD0] p-3.5 shadow-lg max-w-[280px]">
                <div className="w-9 h-9 rounded-full bg-[#FFF0D6] flex items-center justify-center text-[#E85D04] shrink-0">
                  <Flame size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#E85D04] uppercase tracking-wider">Le spot du moment</p>
                  <p className="font-bold text-sm text-[#2C2416] mt-0.5">Chez Mama Africa</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} size={11} className="fill-[#E85D04] text-[#E85D04]" />
                    ))}
                    <span className="text-xs text-[#6B5E4F] ml-1.5 font-medium">4.8</span>
                  </div>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ouvert
                  </span>
                </div>
              </div>
            </div>

            {/* Right - rotating images of people eating/drinking */}
            <div className="relative order-1 lg:order-2">
              <div className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] lg:aspect-[5/4] relative">
                {HERO_IMAGES.map((src, i) => (
                  <img
                    key={src}
                    src={src}
                    alt="Ambiance CHEZ NOUS"
                    className={`absolute inset-0 w-full h-full object-cover hero-img ${
                      i === heroIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
                {/* dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {HERO_IMAGES.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setHeroIndex(i)}
                      className={`w-2 h-2 rounded-full transition ${
                        i === heroIndex ? 'bg-white scale-125' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 space-y-14 pb-16">
        {/* Categories */}
        <section>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((c, idx) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/establishments?type=${c.id}`}
                  className={`flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition hover:scale-105 ${
                    idx === 0
                      ? 'bg-[#E85D04] text-white shadow-sm'
                      : 'bg-white border border-[#E8DFD0] text-[#6B5E4F] hover:border-[#E85D04]/40 hover:text-[#E85D04]'
                  }`}
                >
                  <Icon size={15} />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredEsts.slice(0, 5).map((est, idx) => {
                const open = isOpenNow(est.opening_hours) === true;
                return (
                  <Link
                    key={est.id}
                    to={`/e/${slugify(est.name, est.id)}`}
                    className="rounded-2xl border border-[#E8DFD0] bg-white overflow-hidden shadow-sm hover:shadow-xl hover:border-[#E85D04]/25 hover:-translate-y-1 transition-all duration-300 group"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="h-32 sm:h-36 bg-[#F7F0E6] relative overflow-hidden">
                      {est.logo_url ? (
                        <img
                          src={est.logo_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#C4B5A0]">
                          <UtensilsCrossed size={28} />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 text-[10px] font-bold bg-white/95 text-[#2C2416] px-2 py-0.5 rounded-md capitalize shadow-sm">
                        {est.type || 'Établissement'}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-sm text-[#2C2416] truncate">{est.name}</p>
                      {est.address && (
                        <p className="mt-1 text-[11px] text-[#8A7B6B] flex items-center gap-1 truncate">
                          <MapPin size={11} className="text-[#E85D04] shrink-0" />
                          {est.address}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[11px] font-semibold flex items-center gap-1 ${open ? 'text-emerald-700' : 'text-[#A89880]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#D6CBB8]'}`} />
                          {open ? 'Ouvert' : '—'}
                        </span>
                        <span className="text-xs font-medium text-[#6B5E4F] flex items-center gap-0.5">
                          <Star size={11} className="fill-[#E85D04] text-[#E85D04]" />
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

        {/* ========== SERVICES / PRESTATAIRES ========== */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#2C2416]">Services & Prestataires</h2>
              <p className="text-sm text-[#8A7B6B] mt-1">DJ, photographes, traiteurs et plus encore</p>
            </div>
            <Link to="/services" className="text-sm font-semibold text-[#E85D04] hover:text-[#C2410C] flex items-center gap-1">
              Voir tout <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map((s, idx) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.title}
                  to="/services"
                  className="group relative rounded-2xl overflow-hidden bg-white border border-[#E8DFD0] p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon size={22} />
                  </div>
                  <p className="font-bold text-[#2C2416]">{s.title}</p>
                  <p className="text-sm text-[#8A7B6B] mt-1">{s.desc}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-[#E85D04] opacity-0 group-hover:opacity-100 transition">
                    Découvrir <ArrowRight size={12} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-3xl bg-gradient-to-br from-[#E85D04] to-[#9a3412] p-8 sm:p-11 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-8 w-20 h-20 rounded-full bg-white/30 animate-float" />
            <div className="absolute bottom-6 right-12 w-14 h-14 rounded-full bg-white/20 animate-float" style={{ animationDelay: '1.5s' }} />
          </div>
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
