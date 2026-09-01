import { useEffect, useMemo, useState } from 'react';
import {
  User, X, Loader2, Beer, UtensilsCrossed, Wine, Store, MapPin, Phone,
  ChevronRight, LogIn, UserPlus, Building2, Eye, Search, Home, Menu
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

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
  { id: 'all', label: 'Tout' },
  { id: 'maquis', label: 'Maquis' },
  { id: 'bar', label: 'Bars' },
  { id: 'restaurant', label: 'Restaurants' },
];

export default function PublicHome() {
  const { signIn, signUp, signInWithGoogle, user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [accountType, setAccountType] = useState<'visitor' | 'owner'>('visitor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
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
    let list = ests;
    if (filter !== 'all') {
      list = list.filter((e) => String(e.type || '').toLowerCase().includes(filter));
    }
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          String(e.address || '').toLowerCase().includes(s) ||
          String(e.type || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [ests, filter, q]);

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
      const { error: err } = await signUp(email.trim(), password, fullName.trim());
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
      try {
        await supabase.auth.updateUser({
          data: { account_type: accountType, full_name: fullName.trim() },
        });
      } catch {
        /* */
      }
      if (accountType === 'visitor') {
        setSuccess('Compte visiteur créé.');
        setAuthOpen(false);
        setLoading(false);
        return;
      }
      window.location.assign('/dashboard');
    } catch (ex: any) {
      setError(ex?.message || 'Erreur');
      setLoading(false);
    }
  }

  const typeIcon = (t: string | null) => {
    const x = String(t || '').toLowerCase();
    if (x.includes('restau')) return <UtensilsCrossed size={18} className="text-[#1877F2]" />;
    if (x.includes('bar')) return <Wine size={18} className="text-[#1877F2]" />;
    return <Beer size={18} className="text-[#1877F2]" />;
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-[#1c1e21] font-sans">
      {/* Barre type Facebook */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#dddfe2] shadow-sm">
        <div className="max-w-[1100px] mx-auto px-3 h-[56px] flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold text-sm">
              SM
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="font-bold text-[15px] text-[#1c1e21]">Stock Manager</p>
              <p className="text-[11px] text-[#65676b]">Kevin Tech Pro</p>
            </div>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#65676b]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un maquis, bar, restaurant…"
              className="w-full h-10 rounded-full bg-[#F0F2F5] border-0 pl-9 pr-3 text-sm text-[#1c1e21] placeholder:text-[#65676b] focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => window.location.assign('/dashboard')}
                  className="hidden sm:inline-flex h-9 px-3 rounded-lg bg-[#E7F3FF] text-[#1877F2] text-sm font-semibold hover:bg-[#dbeafe]"
                >
                  Mon espace
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-10 h-10 rounded-full bg-[#E4E6EB] flex items-center justify-center hover:bg-[#d8dadf]"
                  title="Déconnexion"
                >
                  <X size={18} className="text-[#050505]" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen((v) => !v)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  authOpen ? 'bg-[#E7F3FF] text-[#1877F2]' : 'bg-[#E4E6EB] text-[#050505] hover:bg-[#d8dadf]'
                }`}
                aria-label="Compte"
              >
                <User size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Sous-nav filtres */}
        <div className="max-w-[1100px] mx-auto px-3 pb-2 flex gap-1 overflow-x-auto">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 h-8 rounded-full text-[13px] font-semibold whitespace-nowrap ${
                filter === f.id
                  ? 'bg-[#E7F3FF] text-[#1877F2]'
                  : 'text-[#65676b] hover:bg-[#E4E6EB]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Panneau compte pliable */}
        {authOpen && !user && (
          <div className="border-t border-[#dddfe2] bg-white">
            <div className="max-w-md mx-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(null); }}
                  className={`h-10 rounded-lg text-sm font-semibold ${
                    authMode === 'signin' ? 'bg-[#1877F2] text-white' : 'bg-[#E4E6EB] text-[#050505]'
                  }`}
                >
                  <LogIn size={14} className="inline mr-1" /> Connexion
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(null); }}
                  className={`h-10 rounded-lg text-sm font-semibold ${
                    authMode === 'signup' ? 'bg-[#1877F2] text-white' : 'bg-[#E4E6EB] text-[#050505]'
                  }`}
                >
                  <UserPlus size={14} className="inline mr-1" /> Inscription
                </button>
              </div>

              {authMode === 'signup' && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('visitor')}
                    className={`p-3 rounded-xl border text-left text-xs ${
                      accountType === 'visitor' ? 'border-[#1877F2] bg-[#E7F3FF]' : 'border-[#dddfe2]'
                    }`}
                  >
                    <Eye size={16} className="mb-1 text-[#1877F2]" />
                    <p className="font-semibold text-[#1c1e21]">Visiteur</p>
                    <p className="text-[#65676b] mt-0.5">Voir restos & maquis</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('owner')}
                    className={`p-3 rounded-xl border text-left text-xs ${
                      accountType === 'owner' ? 'border-[#1877F2] bg-[#E7F3FF]' : 'border-[#dddfe2]'
                    }`}
                  >
                    <Building2 size={16} className="mb-1 text-[#1877F2]" />
                    <p className="font-semibold text-[#1c1e21]">Professionnel</p>
                    <p className="text-[#65676b] mt-0.5">Gérer mon activité</p>
                  </button>
                </div>
              )}

              <form onSubmit={handleAuth} className="space-y-2">
                {authMode === 'signup' && (
                  <input
                    className="w-full h-11 rounded-lg border border-[#dddfe2] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
                    placeholder="Nom complet"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                )}
                <input
                  className="w-full h-11 rounded-lg border border-[#dddfe2] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
                  placeholder="E-mail, téléphone ou identifiant"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  className="w-full h-11 rounded-lg border border-[#dddfe2] px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
                  type="password"
                  placeholder="Mot de passe (min. 6)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}
                {success && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{success}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : authMode === 'signin' ? 'Se connecter' : "S'inscrire"}
                </button>
              </form>
              <button
                type="button"
                className="mt-2 w-full h-11 rounded-lg bg-[#E4E6EB] text-[#050505] font-semibold text-sm hover:bg-[#d8dadf]"
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

      <main className="max-w-[680px] mx-auto px-3 py-4 space-y-3">
        {/* Carte intro type publication */}
        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-bold text-xs shrink-0">
              SM
            </div>
            <div>
              <p className="font-semibold text-[15px]">Stock Manager AI</p>
              <p className="text-[13px] text-[#65676b] mt-0.5">
                Découvrez les maquis, bars et restaurants. Menus et infos visibles sans compte.
              </p>
            </div>
          </div>
        </div>

        {/* Annonces = posts */}
        {anns.map((a) => (
          <article key={a.id} className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden">
            <div className="p-3 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#E4E6EB] flex items-center justify-center">
                <Store size={18} className="text-[#65676b]" />
              </div>
              <div>
                <p className="font-semibold text-[15px] leading-tight">{a.title}</p>
                <p className="text-[12px] text-[#65676b]">Publication · Stock Manager</p>
              </div>
            </div>
            <div className="px-3 pb-3">
              <p className="text-[15px] text-[#1c1e21] whitespace-pre-wrap">{a.body}</p>
            </div>
            {a.image_url && (
              <img src={a.image_url} alt="" className="w-full max-h-72 object-cover border-t border-[#dddfe2]" />
            )}
            {a.link_url && (
              <a
                href={a.link_url}
                className="block px-3 py-2.5 text-[14px] font-semibold text-[#1877F2] border-t border-[#dddfe2] hover:bg-[#F0F2F5]"
              >
                Voir plus
              </a>
            )}
          </article>
        ))}

        {/* Feed établissements */}
        {listLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#1877F2]" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-8 text-center">
            <Store className="mx-auto text-[#bcc0c4]" size={40} />
            <p className="mt-3 font-semibold text-[15px]">Aucune vitrine pour le moment</p>
            <p className="mt-1 text-[13px] text-[#65676b]">
              Les établissements apparaîtront ici lorsqu’ils activeront leur menu public.
            </p>
          </div>
        ) : (
          filtered.map((est) => (
            <a
              key={est.id}
              href={`/m/${est.id}`}
              className="block bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E4E6EB] overflow-hidden flex items-center justify-center shrink-0">
                  {est.logo_url ? (
                    <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    typeIcon(est.type)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] truncate">{est.name}</p>
                  <p className="text-[13px] text-[#65676b] capitalize">
                    {est.type || 'Établissement'}
                    {est.address ? ` · ${est.address}` : ''}
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#bcc0c4] shrink-0" />
              </div>
              <div className="h-[160px] bg-[#E4E6EB] flex items-center justify-center border-t border-[#f0f2f5]">
                {est.logo_url ? (
                  <img src={est.logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center text-[#65676b]">
                    <Store size={36} className="mx-auto opacity-40" />
                    <p className="text-xs mt-2">Menu & offres</p>
                  </div>
                )}
              </div>
              <div className="px-3 py-2.5 flex flex-wrap gap-3 text-[13px] text-[#65676b] border-t border-[#dddfe2]">
                {est.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {est.address}
                  </span>
                )}
                {est.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={14} /> {est.phone}
                  </span>
                )}
                <span className="ml-auto font-semibold text-[#1877F2]">Voir le menu</span>
              </div>
            </a>
          ))
        )}

        <p className="text-center text-[12px] text-[#8a8d91] py-6">
          Stock Manager AI · Kevin Tech Pro
        </p>
      </main>
    </div>
  );
}
