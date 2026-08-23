import { type ReactNode, useState, useEffect , useRef} from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, ClipboardCheck, Users, Building2,
  Beer, LogOut, Menu, X, UserCog, ClipboardList, Calculator, BarChart3, Truck, UserCircle,
  Calendar, UtensilsCrossed, Bell, Settings, Sparkles, Receipt, Wallet, MessageCircle, FileText,
} from 'lucide-react';
import DailyReportGate from '@/components/DailyReportGate';
import OwnerReportReminder from '@/components/OwnerReportReminder';
import ReportDelayNotifier from '@/components/ReportDelayNotifier';
import PermissionsOnboarding from '@/components/PermissionsOnboarding';
import SubscriptionGate from '@/components/SubscriptionGate';
import { useAuth } from '@/lib/auth';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { startPrefetchInterval } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/types';
import type { Role } from '@/lib/types';
import OfflineBanner from '@/components/OfflineBanner';
import UpdateBanner from '@/components/UpdateBanner';
import { displayLogin } from '@/lib/login';
import TypePicker from '@/components/TypePicker';
import {
  applyBusinessTheme,
  normalizeBusinessType,
  MENU_BY_TYPE,
  BUSINESS_LABELS,
  BUSINESS_THEMES,
  canManageEstablishments,
  menuLabelFor,
  getBusinessUI,
} from '@/lib/businessTypes';

interface NavSection {
  label: string;
  items: { to: string; label: string; icon: ReactNode; roles: Role[] }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/dashboard', label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/pos', label: 'Caisse (POS)', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/documents', label: 'Devis & Factures', icon: <FileText size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/orders', label: 'Commandes', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/kitchen', label: 'Cuisine / Bar', icon: <UtensilsCrossed size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'employee'] },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { to: '/inventory', label: 'Inventaire', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/tables', label: 'Tables', icon: <LayoutDashboard size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/mes-employes', label: 'Mes employés', icon: <Users size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/calendar', label: 'Planning', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/customers', label: 'Clients', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
    ],
  },
  {
    label: 'Finances',
    items: [
      { to: '/expenses', label: 'Dépenses', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/suppliers', label: 'Fournisseurs', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/purchases', label: 'Achats', icon: <ShoppingCart size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/accounting', label: 'Comptabilité', icon: <Calculator size={20} />, roles: ['super_admin', 'admin', 'owner'] },
      { to: '/statistics', label: 'Statistiques', icon: <BarChart3 size={20} />, roles: ['super_admin', 'admin', 'owner'] },
    ],
  },
  {
    label: 'Outils',
    items: [
      { to: '/ai', label: 'Assistant IA', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/chat', label: 'Chat interne', icon: <MessageCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/notifications', label: 'Notifications', icon: <Bell size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/settings', label: 'Profil & Paramètres', icon: <Settings size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/daily-report', label: 'Rapport du jour', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier', 'employee'] },
      { to: '/rent/equipment', label: 'Matériel', icon: <Package size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/clients', label: 'Clients location', icon: <UserCircle size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/rent/orders', label: 'Commandes location', icon: <Receipt size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager', 'cashier'] },
      { to: '/rent/movements', label: 'Sorties & retours', icon: <Truck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/payments', label: 'Paiements location', icon: <Wallet size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/calendar', label: 'Calendrier location', icon: <Calendar size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/packs', label: 'Packs événements', icon: <Sparkles size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/rent/invoices', label: 'Factures location', icon: <ClipboardCheck size={20} />, roles: ['super_admin', 'admin', 'owner', 'manager'] },
      { to: '/admin', label: 'Administration', icon: <UserCog size={20} />, roles: ['super_admin'] },
    ],
  },
];


const SECTION_META: Record<string, { emoji: string; gradient: string; border: string; iconBg: string; text: string }> = {
  Principal: {
    emoji: '🏠',
    gradient: 'linear-gradient(90deg, rgba(245,158,11,0.35), rgba(234,88,12,0.2), rgba(245,158,11,0.35))',
    border: 'rgba(245,158,11,0.35)',
    iconBg: 'bg-amber-500/20 text-amber-300',
    text: 'text-amber-200',
  },
  Gestion: {
    emoji: '📦',
    gradient: 'linear-gradient(90deg, rgba(16,185,129,0.3), rgba(5,150,105,0.18), rgba(16,185,129,0.3))',
    border: 'rgba(16,185,129,0.35)',
    iconBg: 'bg-emerald-500/20 text-emerald-300',
    text: 'text-emerald-200',
  },
  Finances: {
    emoji: '💰',
    gradient: 'linear-gradient(90deg, rgba(34,197,94,0.28), rgba(234,179,8,0.22), rgba(34,197,94,0.28))',
    border: 'rgba(234,179,8,0.4)',
    iconBg: 'bg-yellow-500/20 text-yellow-300',
    text: 'text-yellow-200',
  },
  Outils: {
    emoji: '🛠️',
    gradient: 'linear-gradient(90deg, rgba(56,189,248,0.28), rgba(99,102,241,0.22), rgba(56,189,248,0.28))',
    border: 'rgba(56,189,248,0.35)',
    iconBg: 'bg-sky-500/20 text-sky-300',
    text: 'text-sky-200',
  },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { member, signOut, myEstablishments, activeEstablishment, switchEstablishment, refresh, effectiveRole, viewAsRole, setViewAsRole } = useAuth();

  // Déconnexion auto après 15 min sans activité
  useIdleTimeout(() => {
    void (async () => {
      try {
        await signOut();

  useEffect(() => {
    return startPrefetchInterval(
      () => activeEstablishment?.id || member?.establishment_id,
      supabase,
      3 * 60 * 1000
    );
  }, [activeEstablishment?.id, member?.establishment_id]);
      } finally {
        window.location.assign('/');
      }
    })();
  }, Boolean(member));

  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [estName, setEstName] = useState<string | null>(null);
  const [estLogo, setEstLogo] = useState<string | null>(null);

  const bizType = normalizeBusinessType(activeEstablishment?.type);
  const theme = BUSINESS_THEMES[bizType];
  // Tous les types d'établissements ont accès aux mêmes menus (filtrage par rôle uniquement)

  useEffect(() => {
    applyBusinessTheme(bizType);
  }, [bizType]);

  useEffect(() => {
    if (!member?.user_id) return;
    (async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.user_id)
        .eq('read', false);
      setUnreadNotifs(count ?? 0);

      if (activeEstablishment) {
        setEstName(activeEstablishment.name);
        setEstLogo(activeEstablishment.logo_url ?? null);
      } else if (member.establishment_id) {
        const { data } = await supabase
          .from('establishments')
          .select('name, logo_url, type')
          .eq('id', member.establishment_id)
          .maybeSingle();
        if (data) {
          setEstName(data.name);
          setEstLogo((data as any).logo_url ?? null);
        }
      } else {
        setEstName(null);
        setEstLogo(null);
      }
    })();
  }, [member, activeEstablishment]);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      /* ignore */
    } finally {
      try {
        sessionStorage.setItem('mm_signed_out', '1');
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (k.startsWith('sb-') || k.startsWith('mm_') || k.includes('supabase')) {
            localStorage.removeItem(k);
          }
        }
      } catch { /* */ }
      window.location.replace('/');
    }
  }

  const allowedRoutes = new Set(MENU_BY_TYPE[bizType] || MENU_BY_TYPE.maquis);

  const RENT_ONLY = new Set([
    '/rent/equipment',
    '/rent/clients',
    '/rent/orders',
    '/rent/movements',
    '/rent/payments',
    '/rent/calendar',
    '/rent/packs',
    '/rent/invoices',
  ]);

  const isLocation = bizType === 'location_event';

  const visibleSections = NAV_SECTIONS.map((section) => {
    let items = section.items.filter((item) => {
      if (!member) return false;
      if (item.to === '/admin') return member.role === 'super_admin';

      // Filtre métier : uniquement les routes du type d'établissement
      if (!allowedRoutes.has(item.to)) return false;

      // Modules location uniquement pour location_event (et dans Outils)
      if (RENT_ONLY.has(item.to) && !isLocation) return false;
      if (RENT_ONLY.has(item.to) && section.label !== 'Outils') return false;

      const roleForMenu = effectiveRole || member.role;
      if (['super_admin', 'admin', 'owner', 'manager'].includes(roleForMenu)) {
        return true;
      }
      const r = roleForMenu;
      return item.roles.includes(r);
    });

    // Libellés adaptés location
    if (isLocation && section.label === 'Outils') {
      items = items.map((item) => {
        if (item.to === '/rent/equipment') return { ...item, label: 'Parc matériel' };
        if (item.to === '/rent/clients') return { ...item, label: 'Clients' };
        if (item.to === '/rent/orders') return { ...item, label: 'Commandes' };
        if (item.to === '/rent/calendar') return { ...item, label: 'Calendrier' };
        if (item.to === '/rent/invoices') return { ...item, label: 'Devis & Factures' };
        if (item.to === '/rent/movements') return { ...item, label: 'Sorties & retours' };
        if (item.to === '/rent/payments') return { ...item, label: 'Paiements' };
        if (item.to === '/rent/packs') return { ...item, label: 'Packs événements' };
        return item;
      });
    }

    // Maquis / bar : renommer Cuisine
    if ((bizType === 'maquis') && section.label === 'Principal') {
      items = items.map((item) =>
        item.to === '/kitchen' ? { ...item, label: 'Grill / Bar' } : item
      );
    }

    return { ...section, items };
  }).filter((section) => section.items.length > 0);

  // Cache local : une fois un établissement vu, ne plus JAMAIS imposer TypePicker
  let cachedEst = false;
  let cachedEstPayload: { id?: string; type?: string; name?: string } | null = null;
  try {
    const raw = localStorage.getItem('mm_active_est');
    const ids = localStorage.getItem('mm_est_ids');
    cachedEst = Boolean(raw || ids);
    if (raw) cachedEstPayload = JSON.parse(raw);
  } catch { /* */ }

  const hasEstablishment = Boolean(
    member?.establishment_id ||
    activeEstablishment?.id ||
    (myEstablishments && myEstablishments.length > 0) ||
    cachedEst
  );

  // Persiste en session React : évite le clignotement à chaque refresh()
  const hadEstRef = useRef(false);
  if (hasEstablishment) hadEstRef.current = true;

  // TypePicker UNIQUEMENT si :
  // - membre chargé
  // - aucun établissement (membre + liste + cache)
  // - jamais eu d'établissement dans cette session
  // - pas admin / super_admin
  // - pas owner déjà lié (owner avec establishment_id ne doit jamais revoir l'écran)
  const isPrivileged = ['super_admin', 'admin'].includes(member?.role || '');
  const isExistingStaff =
    ['owner', 'manager', 'cashier', 'employee'].includes(member?.role || '') &&
    (Boolean(member?.establishment_id) || hadEstRef.current || cachedEst);

  // Staff invité (gérant/caissier/employé) : JAMAIS l'écran "créer une activité"
  const isInvitedStaffRole = ['manager', 'cashier', 'employee'].includes(member?.role || '');

  // TypePicker uniquement pour un vrai nouveau propriétaire sans établissement
  const showTypePicker =
    Boolean(member) &&
    !isPrivileged &&
    !isInvitedStaffRole &&
    !hasEstablishment &&
    !hadEstRef.current &&
    !isExistingStaff &&
    !member?.establishment_id &&
    !cachedEst;

  if (isInvitedStaffRole && !member?.establishment_id && !hasEstablishment) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">Compte équipe</h1>
          <p className="text-stone-400 text-sm">
            Votre compte est reconnu comme membre d&apos;équipe, mais aucun établissement
            ne vous est encore lié. Demandez au propriétaire de recréer ou confirmer votre accès
            dans <strong>Mon équipe</strong>.
          </p>
          <button type="button" className="btn-secondary" onClick={() => refresh()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (showTypePicker) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <TypePicker mode="create" onDone={() => refresh()} />
      </div>
    );
  }

  // Type inconnu : ne pas bloquer toute l'app — fallback type "maquis"
  const knownTypes = new Set([
    'maquis', 'magasin', 'boutique', 'superette',
    'quincaillerie', 'location_event',
  ]);
  const rawType = (activeEstablishment?.type || cachedEstPayload?.type || '').toLowerCase().trim();
  // Ancien écran "choose-type" désactivé pour éviter le spam récursif chez tous les users
  // if (member?.establishment_id && activeEstablishment && rawType && !knownTypes.has(rawType)) { TypePicker choose-type }
  void rawType;
  void knownTypes;

  return (
    <div className="min-h-screen bg-stone-950 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-stone-900 border-r border-stone-800 flex flex-col z-40 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-800 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 overflow-hidden">
            {estLogo ? (
              <img src={estLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <Beer size={20} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold font-display text-stone-100 text-sm truncate">
              {estName || 'Stock Manager AI'}
            </p>
            <p className="text-xs text-stone-500 truncate">{member ? ROLE_LABELS[member.role] : ''}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
          {visibleSections.map((section, sIdx) => {
            const meta = SECTION_META[section.label] || {
              emoji: '✨',
              gradient: 'linear-gradient(90deg, rgba(168,162,158,0.25), rgba(87,83,78,0.2))',
              border: 'rgba(168,162,158,0.3)',
              iconBg: 'bg-stone-600/40 text-stone-300',
              text: 'text-stone-300',
            };
            return (
            <div
              key={section.label}
              className="nav-section-card"
              style={{ borderColor: meta.border, animationDelay: `${sIdx * 0.15}s` }}
            >
              <div
                className={`nav-section-head ${meta.text}`}
                style={{ backgroundImage: meta.gradient, border: `1px solid ${meta.border}` }}
              >
                <span className="nav-section-emoji" style={{ animationDelay: `${sIdx * 0.3}s` }}>
                  {meta.emoji}
                </span>
                <span>{section.label}</span>
                <span className="ml-auto opacity-70 text-[10px]">{section.items.length}</span>
              </div>
              <div className="space-y-0.5 px-0.5 pb-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `nav-item-link flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'active bg-stone-800/90 text-stone-50 shadow-inner ring-1 ring-white/10'
                          : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/50'
                      }`
                    }
                  >
                    <span className={`nav-item-icon ${meta.iconBg}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{menuLabelFor(item.to, bizType) || item.label}</span>
                    {item.to === '/notifications' && unreadNotifs > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-error-500 text-white animate-pulse">
                        {unreadNotifs}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
            );
          })}
        </nav>

        {/* Sélecteur d'activité : uniquement propriétaire/admin avec plusieurs établissements */}
        {member &&
          ['super_admin', 'admin', 'owner'].includes(member.role) &&
          myEstablishments.length > 1 && (
          <div className="px-3 pb-2">
            <label className="text-[10px] uppercase tracking-wide text-violet-300/90 px-1 flex items-center gap-1">
              <span className="nav-section-emoji text-sm">🎯</span> Activité
            </label>
            <select
              className="input-field text-sm py-2 mt-1"
              value={member?.establishment_id ?? ''}
              onChange={async (e) => {
                if (e.target.value) await switchEstablishment(e.target.value);
              }}
              style={{ borderColor: theme.primary + '55' }}
            >
              {myEstablishments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({BUSINESS_LABELS[normalizeBusinessType(e.type)]})
                </option>
              ))}
            </select>
          </div>
        )}
        {member &&
          ['super_admin', 'admin', 'owner'].includes(member.role) &&
          myEstablishments.length === 1 && (
          <div className="px-3 pb-2">
            <p className="text-[10px] uppercase tracking-wide text-violet-300/90 px-1 flex items-center gap-1">
              <span className="nav-section-emoji text-sm">🎯</span> Activité
            </p>
            <p className="text-xs text-stone-400 px-1 mt-1 truncate">
              {myEstablishments[0].name} ({BUSINESS_LABELS[normalizeBusinessType(myEstablishments[0].type)]})
            </p>
          </div>
        )}
        <div className="p-3 border-t border-stone-800 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center shrink-0">
              <Users size={16} className="text-stone-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-200 truncate">{member?.full_name ?? displayLogin(member?.email)}</p>
              <p className="text-xs text-stone-500 truncate">{displayLogin(member?.email)}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-400 hover:text-error-300 hover:bg-error-500/10 transition-all"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-800 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="text-stone-300">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            {estLogo ? (
              <img src={estLogo} alt="" className="w-6 h-6 rounded object-cover" />
            ) : (
              <Beer size={20} className="text-primary-500" />
            )}
            <div className="flex items-center gap-2 min-w-0">
              <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <span className="font-display font-bold text-stone-100 truncate">{estName || 'Stock Manager AI'}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-stone-300 p-1 rounded-lg hover:bg-stone-800"
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24"><SubscriptionGate />
          <DailyReportGate />
          <OwnerReportReminder />
          <ReportDelayNotifier />
          <PermissionsOnboarding />
        {children}</main>
        <UpdateBanner />
      <footer className="px-4 py-3 text-center text-[11px] text-stone-500 border-t border-stone-800/80">
        <span className="text-stone-400 font-medium">Stock Manager AI</span>
        {' · '}
        <span>Powered by <span className="text-amber-500/90">Kevin Tech Pro</span></span>
      </footer>
      <OfflineBanner />
      </div>

      {sidebarOpen && (
        <button onClick={() => setSidebarOpen(false)} className="fixed top-4 right-4 z-50 text-stone-300 lg:hidden">
          <X size={24} />
        </button>
      )}
    </div>
  );
}
