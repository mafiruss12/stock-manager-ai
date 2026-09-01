import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Star, Clock, ChevronRight, Loader2, UtensilsCrossed,
  Beer, Wine, Calendar, Sparkles, Phone, ArrowRight
} from 'lucide-react';
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
  public_menu?: boolean;
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
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed },
  { id: 'maquis', label: 'Maquis', icon: Beer },
  { id: 'bar', label: 'Bars', icon: Wine },
];

export default function PublicHome() {
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
          .select('id, name, type, address, phone, logo_url, public_menu')
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
    return list;
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
        className="h-10 px-3 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100"
      >
        Mon espace
      </button>
      <button type="button" onClick={() => void signOut()} className="text-xs text-slate-500 hover:text-slate-800">
        Quitter
      </button>
    </div>
  ) : null;

  return (
    <PublicLayout onOpenAuth={user ? undefined : openAuth} rightSlot={rightSlot}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=60)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-blue-950/40" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">Stock Manager AI</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-2xl leading-[1.15]">
            Découvrez les meilleurs établissements autour de vous
          </h1>
          <p className="mt-4 text-slate-300 text-base sm:text-lg max-w-xl">
            Restaurants, maquis, bars, menus du jour, événements et services — au même endroit.
          </p>

          <div className="mt-8 max-w-2xl bg-white rounded-2xl p-2 sm:p-3 shadow-2xl shadow-black/30">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Que recherchez-vous ?"
                  className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  value={where}
                  onChange={(e) => setWhere(e.target.value)}
                  placeholder="Où êtes-vous ? (ex. Cocody)"
                  className="w-full h-12 rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <Link
                to={`/establishments${q || where ? `?q=${encodeURIComponent(q)}&where=${encodeURIComponent(where)}` : ''}`}
                className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                Explorer <ArrowRight size={16} />
              </Link>
            </div>
            <p className="px-2 pt-2 text-[11px] text-slate-400">
              Ex. maquis · poulet braisé · bar Cocody · événement ce week-end
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 space-y-14 py-12">
        {/* Categories */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Explorer par type</h2>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.id}
                  to={`/establishments?type=${c.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
                    <Icon size={20} />
                  </div>
                  <p className="font-semibold text-sm sm:text-base">{c.label}</p>
                  <p className="text-xs text-slate-500 mt-1 hidden sm:block">Voir la sélection</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Discover establishments */}
        <section id="discover">
          <div className="flex items-end justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Découvrez les établissements</h2>
              <p className="text-sm text-slate-500 mt-1">Vitrines publiques activées par les pros</p>
            </div>
            <Link to="/establishments" className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
              Tout voir <ChevronRight size={16} />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
          ) : filteredEsts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="font-semibold text-slate-800">Aucune vitrine publique pour le moment</p>
              <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Les établissements apparaîtront ici dès qu’un propriétaire active le menu public dans Stock Manager.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEsts.slice(0, 6).map((est) => (
                <article
                  key={est.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition group"
                >
                  <div className="h-40 bg-slate-200 relative overflow-hidden">
                    {est.logo_url ? (
                      <img src={est.logo_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-400">
                        <UtensilsCrossed size={36} />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 text-[11px] font-semibold bg-white/95 text-slate-800 px-2 py-1 rounded-full capitalize shadow-sm">
                      {est.type || 'Établissement'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900">{est.name}</h3>
                    {est.address && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} /> {est.address}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={`/m/${est.id}`}
                        className="flex-1 text-center h-9 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-blue-700"
                      >
                        Voir le menu
                      </Link>
                      <Link
                        to={`/m/${est.id}`}
                        className="flex-1 text-center h-9 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center hover:bg-slate-200"
                      >
                        Découvrir
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Menu du jour from stock */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Menus & disponibilités</h2>
              <p className="text-sm text-slate-500 mt-1">Reliés au stock public des établissements</p>
            </div>
          </div>
          {menuItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Les plats et boissons publics s’affichent ici dès qu’un établissement partage son menu.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {menuItems.slice(0, 9).map((p) => {
                const available = Number(p.stock) > 0;
                return (
                  <Link
                    key={p.id}
                    to={`/m/${p.establishment_id}`}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 hover:border-blue-200 hover:shadow-sm transition"
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <UtensilsCrossed size={20} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.est_name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {Number(p.price).toLocaleString('fr-FR')} F
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {available ? `${p.stock} dispo` : 'Épuisé'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Events from announcements for now */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-blue-600" /> Événements & à la une
              </h2>
              <p className="text-sm text-slate-500 mt-1">Publications et temps forts des établissements</p>
            </div>
            <Link to="/events" className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={16} />
            </Link>
          </div>
          {anns.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Les événements publiés par les pros apparaîtront ici.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {anns.map((a) => (
                <article key={a.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {a.image_url && (
                    <img src={a.image_url} alt="" className="w-full h-40 object-cover" loading="lazy" />
                  )}
                  <div className="p-4">
                    <p className="font-bold text-slate-900">{a.title}</p>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-3">{a.body}</p>
                    {a.link_url && (
                      <a href={a.link_url} className="inline-flex mt-3 text-sm font-semibold text-blue-600 hover:underline">
                        Découvrir
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Services teaser */}
        <section className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Services</p>
              <h2 className="text-2xl font-bold mt-1">DJ, traiteur, photo, déco…</h2>
              <p className="text-blue-100 text-sm mt-2 max-w-md">
                Bientôt : annuaire de prestataires liés aux établissements et aux événements.
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex h-11 px-5 rounded-xl bg-white text-blue-800 font-semibold text-sm items-center gap-2 hover:bg-blue-50"
            >
              Voir les services <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* CTA pro */}
        {!user && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Sparkles className="mx-auto text-blue-600 mb-3" size={28} />
            <h2 className="text-xl font-bold">Vous avez un établissement ?</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
              Gérez stock, équipe, caisse et vitrine publique avec Stock Manager AI.
            </p>
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="mt-5 h-11 px-6 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
            >
              Créer un compte professionnel
            </button>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}
