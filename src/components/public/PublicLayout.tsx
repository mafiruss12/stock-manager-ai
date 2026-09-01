import { useState, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Search } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/discover', label: 'Découvrir' },
  { to: '/establishments', label: 'Établissements' },
  { to: '/events', label: 'Événements' },
  { to: '/services', label: 'Services' },
];

export default function PublicLayout({
  children,
  onOpenAuth,
  rightSlot,
}: {
  children: ReactNode;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
  rightSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-900">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/25">
              SM
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-[15px] tracking-tight truncate">Stock Manager</p>
              <p className="text-[11px] text-slate-500 truncate">Découvrir · Gérer · Développer</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = loc.pathname === n.to || (n.to !== '/' && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {rightSlot}
            {onOpenAuth && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="hidden sm:inline-flex h-10 px-3 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="h-10 px-3.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  Créer un compte
                </button>
              </>
            )}
            <button
              type="button"
              className="md:hidden w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-bold text-slate-900">Stock Manager AI</p>
            <p className="text-slate-500 mt-2 text-[13px] leading-relaxed">
              La plateforme intelligente pour découvrir, promouvoir et gérer les établissements en Côte d&apos;Ivoire.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-2">Explorer</p>
            <div className="space-y-1.5 text-slate-500">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className="block hover:text-blue-600">
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-2">Kevin Tech Pro</p>
            <p className="text-slate-500 text-[13px]">Abidjan · WhatsApp pro disponible depuis l&apos;espace propriétaire.</p>
          </div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Stock Manager AI — Kevin Tech Pro
        </div>
      </footer>
    </div>
  );
}
