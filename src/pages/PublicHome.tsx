import { useEffect, useMemo, useState } from 'react';
import {
  User, X, Loader2, Beer, UtensilsCrossed, Wine, Store, MapPin, Phone,
  ChevronRight, Sparkles, LogIn, UserPlus, Building2, Eye
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { toAuthEmail } from '@/lib/login';

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

const TYPE_FILTERS = [
  { id: 'all', label: 'Tous', icon: Store },
  { id: 'maquis', label: 'Maquis', icon: Beer },
  { id: 'bar', label: 'Bars', icon: Wine },
  { id: 'restaurant', label: 'Restaurants', icon: UtensilsCrossed },
];

const TYPE_SHOWCASE = [
  {
    id: 'maquis',
    title: 'Maquis',
    text: 'Boissons, casiers, point du jour, suivi stock en temps réel.',
    icon: Beer,
    color: 'from-amber-600/40 to-orange-900/30',
  },
  {
    id: 'bar',
    title: 'Bars',
    text: 'Carte des boissons, soirées, dispos et promos du moment.',
    icon: Wine,
    color: 'from-violet-600/40 to-purple-900/30',
  },
  {
    id: 'restaurant',
    title: 'Restaurants',
    text: 'Menu du jour, plats, service en salle et cuisine.',
    icon: UtensilsCrossed,
    color: 'from-emerald-600/40 to-teal-900/30',
  },
];

export default function PublicHome() {
  const { signIn, signUp, signInWithGoogle, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [accountType, setAccountType] = useState<'visitor' | 'owner'>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [filter, setFilter] = useState('all');
  const [ests, setEsts] = useState<PubEst[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      const [eRes, aRes] = await Promise.all([
        supabase
          .from('establishments')
          .select('id, name, type, address, phone, logo_url, public_menu')
          .eq('public_menu', true)
          .order('name')
          .limit(60),
        supabase
          .from('app_announcements')
          .select('id, title, body, link_url, image_url')
          .eq('active', true)
          .order('sort_order', { ascending: true })
          .limit(12),
      ]);
      if (cancelled) return;
      setEsts((eRes.data as PubEst[]) || []);
      setAnns((aRes.data as Ann[]) || []);
      setListLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return ests;
    return ests.filter((e) => String(e.type || '').toLowerCase().includes(filter));
  }, [ests, filter]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (authMode === 'signin') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) {
          setError(err);
          setLoading(false);
          return;
        }
        setSuccess('Connexion…');
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u?.user_metadata?.account_type === 'visitor') {
          setAuthOpen(false);
          setLoading(false);
          window.location.assign('/');
          return;
        }
        window.location.assign('/dashboard');
        return;
      }
      if (!fullName.trim()) {
        setError('Nom complet requis');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Mot de passe : minimum 6 caractères');
        setLoading(false);
        return;
      }
      // metadata account type via signUp then update if needed
      const { error: err } = await signUp(email.trim(), password, fullName.trim());
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      try {
        await supabase.auth.updateUser({
          data: {
            account_type: accountType,
            full_name: fullName.trim(),
          },
        });
      } catch {
        /* ignore */
      }
      if (accountType === 'visitor') {
        setSuccess('Compte visiteur créé. Explorez les établissements.');
        setAuthOpen(false);
        setLoading(false);
        return;
      }
      setSuccess('Compte pro créé…');
      window.location.assign('/dashboard');
    } catch (ex: any) {
      setError(ex?.message || 'Erreur');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo-full.png" alt="Stock Manager AI" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">Stock Manager AI</p>
              <p className="text-[10px] text-amber-400/90 truncate">Kevin Tech Pro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline text-xs text-stone-400 max-w-[140px] truncate">
                  {user.email}
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs py-1.5 px-3"
                  onClick={() => window.location.assign('/dashboard')}
                >
                  Mon espace
                </button>
                <button type="button" className="p-2 rounded-xl border border-stone-700 hover:bg-stone-800" onClick={() => void signOut()} title="Déconnexion">
                  <X size={16} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                aria-expanded={authOpen}
              >
                <User size={18} />
                <span className="hidden sm:inline">{authOpen ? 'Fermer' : 'Compte'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Panneau compte pliable */}
        {authOpen && !user && (
          <div className="border-t border-stone-800 bg-stone-900/95">
            <div className="max-w-md mx-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(null); }}
                  className={`py-2 rounded-lg text-sm font-semibold ${authMode === 'signin' ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'}`}
                >
                  <LogIn size={14} className="inline mr-1" /> Connexion
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(null); }}
                  className={`py-2 rounded-lg text-sm font-semibold ${authMode === 'signup' ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'}`}
                >
                  <UserPlus size={14} className="inline mr-1" /> Inscription
                </button>
              </div>

              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('visitor')}
                    className={`p-3 rounded-xl border text-left text-xs ${accountType === 'visitor' ? 'border-sky-400 bg-sky-500/15' : 'border-stone-700'}`}
                  >
                    <Eye size={16} className="mb-1 text-sky-300" />
                    <p className="font-semibold">Visiteur</p>
                    <p className="text-stone-500 mt-0.5">Découvrir restos & maquis</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('owner')}
                    className={`p-3 rounded-xl border text-left text-xs ${accountType === 'owner' ? 'border-amber-400 bg-amber-500/15' : 'border-stone-700'}`}
                  >
                    <Building2 size={16} className="mb-1 text-amber-300" />
                    <p className="font-semibold">Je propose un service</p>
                    <p className="text-stone-500 mt-0.5">Gérer mon établissement</p>
                  </button>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-3">
                {authMode === 'signup' && (
                  <input
                    className="input-field"
                    placeholder="Nom complet"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                )}
                <input
                  className="input-field"
                  placeholder="E-mail, téléphone ou identifiant"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
                <input
                  className="input-field"
                  type="password"
                  placeholder="Mot de passe (min. 6)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                />
                {error && (
                  <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">{success}</p>
                )}
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : authMode === 'signin' ? 'Se connecter' : "S'inscrire"}
                </button>
              </form>
              <button
                type="button"
                className="mt-3 w-full py-2.5 rounded-xl border border-stone-600 text-sm text-stone-200 hover:bg-stone-800"
                onClick={async () => {
                  setError(null);
                  try {
                    await signInWithGoogle();
                  } catch (ex: any) {
                    setError(ex?.message || 'Google indisponible');
                  }
                }}
              >
                Continuer avec Google
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-stone-800 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 p-6 sm:p-10">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Espace public · sans compte obligatoire</p>
          <h1 className="text-2xl sm:text-4xl font-bold font-display leading-tight">
            Découvrez maquis, bars & restaurants
          </h1>
          <p className="mt-3 text-stone-400 max-w-xl text-sm sm:text-base">
            Menus, offres et établissements gérés avec Stock Manager AI. Explorez librement —
            connectez-vous seulement pour gérer votre activité ou enregistrer un compte visiteur.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => { setAuthOpen(true); setAuthMode('signup'); setAccountType('owner'); }}>
              Proposer mon établissement
            </button>
            <button type="button" className="btn-secondary" onClick={() => { setAuthOpen(true); setAuthMode('signup'); setAccountType('visitor'); }}>
              Compte visiteur
            </button>
          </div>
        </section>

        {/* Types */}
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-400" /> Ce que proposent les pros
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {TYPE_SHOWCASE.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilter(t.id)}
                  className={`text-left rounded-2xl border border-stone-700 bg-gradient-to-br ${t.color} p-4 hover:border-amber-500/40 transition`}
                >
                  <Icon size={22} className="text-amber-200 mb-2" />
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-xs text-stone-400 mt-1">{t.text}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Pubs / annonces */}
        {anns.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">À la une</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {anns.map((a) => (
                <a
                  key={a.id}
                  href={a.link_url || '#'}
                  className="min-w-[240px] max-w-xs rounded-2xl border border-stone-700 bg-stone-900/80 p-4 shrink-0 hover:border-amber-500/40"
                >
                  <p className="font-semibold text-amber-200">{a.title}</p>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-3">{a.body}</p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Filtres + liste */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Établissements visibles</h2>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_FILTERS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                      filter === f.id ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    <Icon size={12} /> {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-amber-500" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-700 p-8 text-center text-stone-500 text-sm">
              <p>Aucun établissement n’a encore activé sa vitrine publique.</p>
              <p className="mt-2">Les pros peuvent activer le <strong className="text-stone-300">menu public</strong> dans QR / Menu en ligne.</p>
              <button
                type="button"
                className="btn-primary mt-4"
                onClick={() => { setAuthOpen(true); setAuthMode('signup'); setAccountType('owner'); }}
              >
                Créer mon établissement
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((est) => (
                <a
                  key={est.id}
                  href={`/m/${est.id}`}
                  className="group rounded-2xl border border-stone-700 bg-stone-900/70 overflow-hidden hover:border-amber-500/50 transition"
                >
                  <div className="h-28 bg-gradient-to-br from-stone-800 to-amber-950/40 flex items-center justify-center">
                    {est.logo_url ? (
                      <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="text-stone-600 group-hover:text-amber-500/60 transition" size={40} />
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-100">{est.name}</p>
                        <p className="text-xs text-amber-400/90 capitalize mt-0.5">{est.type || 'Établissement'}</p>
                      </div>
                      <ChevronRight className="text-stone-600 group-hover:text-amber-400 shrink-0" size={18} />
                    </div>
                    {est.address && (
                      <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
                        <MapPin size={12} /> {est.address}
                      </p>
                    )}
                    {est.phone && (
                      <p className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                        <Phone size={12} /> {est.phone}
                      </p>
                    )}
                    <p className="text-[11px] text-emerald-400/90 mt-3">Voir menu & offres →</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <footer className="text-center text-xs text-stone-600 pb-8 pt-4 border-t border-stone-900">
          Stock Manager AI · Kevin Tech Pro · Abidjan
        </footer>
      </main>
    </div>
  );
}
