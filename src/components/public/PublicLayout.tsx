import { useState, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MapPin } from 'lucide-react';

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
    <div className="min-h-screen bg-[#FBF7F0] text-[#2C2416]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8DFD0] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85D04] to-[#C2410C] flex items-center justify-center text-white shadow-md shadow-orange-600/30 group-hover:scale-105 transition-transform">
              <span className="font-bold text-lg leading-none">S</span>
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-[15px] tracking-tight text-[#2C2416] truncate">
                Stock Manager
              </p>
              <p className="text-[11px] text-[#C2410C] font-medium truncate">
                Côte d&apos;Ivoire
              </p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active =
                loc.pathname === n.to ||
                (n.to !== '/' && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'text-[#C2410C] bg-[#FFF0D6]'
                      : 'text-[#6B5E4F] hover:bg-[#F7F0E6] hover:text-[#2C2416]'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8A7B6B] mr-1">
              <MapPin size={14} className="text-[#E85D04]" />
              <span>Abidjan</span>
            </div>

            {rightSlot}

            {onOpenAuth && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signin')}
                  className="hidden sm:inline-flex h-10 px-3 rounded-xl text-sm font-semibold text-[#6B5E4F] hover:bg-[#F7F0E6] transition"
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="h-10 px-4 rounded-xl text-sm font-semibold bg-[#E85D04] text-white hover:bg-[#C2410C] shadow-sm shadow-orange-600/20 transition"
                >
                  Créer un compte
                </button>
              </>
            )}

            <button
              type="button"
              className="md:hidden w-10 h-10 rounded-xl bg-[#F7F0E6] flex items-center justify-center text-[#2C2416]"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-[#E8DFD0] bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#3D3428] hover:bg-[#FBF7F0]"
              >
                {n.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-[#E8DFD0] bg-white mt-16">
        <div className="max-w-6xl mx-auto px-4 py-12 grid sm:grid-cols-3 gap-10 text-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#E85D04] to-[#C2410C] flex items-center justify-center text-white font-bold">
                S
              </div>
              <p className="font-bold text-[#2C2416]">Stock Manager</p>
            </div>
            <p className="text-[#8A7B6B] text-[13px] leading-relaxed">
              La plateforme pour découvrir, promouvoir et gérer les meilleurs
              établissements en Côte d&apos;Ivoire.
            </p>
          </div>

          <div>
            <p className="font-semibold text-[#2C2416] mb-3">Explorer</p>
            <div className="space-y-2 text-[#6B5E4F]">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="block hover:text-[#E85D04] transition"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold text-[#2C2416] mb-3">Kevin Tech Pro</p>
            <p className="text-[#8A7B6B] text-[13px] leading-relaxed">
              Abidjan · Support WhatsApp disponible depuis l&apos;espace
              propriétaire.
            </p>
          </div>
        </div>

        <div className="border-t border-[#E8DFD0] py-4 text-center text-xs text-[#A89880]">
          © {new Date().getFullYear()} Stock Manager AI — Kevin Tech Pro
        </div>
      </footer>
    </div>
  );
}
