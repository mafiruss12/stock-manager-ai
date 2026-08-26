/** Signature Kevin Tech Pro — visible sur toute la plateforme */
const EMAIL = 'kevintechpro0@gmail.com';
const SOCIALS = [
  { label: 'Facebook', href: 'https://www.facebook.com/search/top?q=kevin%20tech%20pro' },
  { label: 'TikTok', href: 'https://www.tiktok.com/search?q=kevin%20tech%20pro' },
];

export default function BrandFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={`brand-footer border-t border-stone-800/80 bg-stone-950/80 ${
        compact ? 'px-3 py-3' : 'px-4 py-4'
      }`}
    >
      <div className="max-w-lg mx-auto flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2.5">
          <img
            src="/kevin-tech-pro-logo.png"
            alt="Kevin Tech Pro"
            className="h-9 w-9 rounded-lg object-contain bg-white p-0.5"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/kevin-tech-pro-logo.jpg';
            }}
          />
          <div className="text-left">
            <p className="text-xs text-stone-400 leading-tight">
              <span className="text-stone-300 font-semibold">Stock Manager AI</span>
            </p>
            <p className="text-sm font-bold text-amber-400 leading-tight">
              Powered by Kevin Tech Pro
            </p>
          </div>
        </div>
        {!compact && (
          <>
            <a
              href={`mailto:${EMAIL}`}
              className="text-xs text-sky-400 hover:underline"
            >
              {EMAIL}
            </a>
            <div className="flex flex-wrap justify-center gap-3 text-[11px]">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-400 hover:text-amber-400 underline-offset-2 hover:underline"
                >
                  {s.label}
                </a>
              ))}
            </div>
            <p className="text-[10px] text-stone-600">
              © {new Date().getFullYear()} Kevin Tech Pro — Tous droits réservés
            </p>
          </>
        )}
      </div>
    </footer>
  );
}
