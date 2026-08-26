import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type AppAnnouncement = {
  id: string;
  title: string;
  body: string;
  link_url?: string | null;
  active: boolean;
  sort_order: number;
};

export async function fetchActiveAnnouncements(): Promise<AppAnnouncement[]> {
  const { data } = await supabase
    .from('app_announcements')
    .select('id, title, body, link_url, active, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  return (data || []) as AppAnnouncement[];
}

/** Bandeau publicité / infos défilant (connexion + dashboard) */
export default function AdMarquee({ className = '' }: { className?: string }) {
  const [items, setItems] = useState<AppAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void fetchActiveAnnouncements().then((list) => {
        if (!cancelled) setItems(list);
      });
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (items.length === 0) return null;

  const parts = items.map((a) => {
    const text = a.title?.trim() ? `${a.title} — ${a.body}` : a.body;
    return { id: a.id, text: text.trim(), href: a.link_url || null };
  }).filter((p) => p.text);

  if (parts.length === 0) return null;

  const content = (
    <>
      {parts.map((p, i) => (
        <span key={`${p.id}-${i}`} className="inline-flex items-center">
          {i > 0 && <span className="mx-4 text-amber-500/70">•</span>}
          {p.href ? (
            <a href={p.href} target="_blank" rel="noopener noreferrer" className="hover:underline text-amber-200">
              {p.text}
            </a>
          ) : (
            <span>{p.text}</span>
          )}
        </span>
      ))}
      <span className="mx-4 text-amber-500/70">•</span>
    </>
  );

  return (
    <div
      className={`ad-marquee-wrap flex items-center gap-2 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 ${className}`}
      role="marquee"
      aria-label="Annonces et publicités"
    >
      <span className="shrink-0 pl-3 text-amber-500">
        <Megaphone size={18} />
      </span>
      <div className="ad-marquee-track flex-1 overflow-hidden py-2.5">
        <div className="ad-marquee-inner text-sm font-medium text-stone-100">
          <span className="ad-marquee-scroll">
            {content}
            {content}
          </span>
        </div>
      </div>
    </div>
  );
}
