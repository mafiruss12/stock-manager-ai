import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';

export default function PublicEvents() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [items, setItems] = useState<{ id: string; title: string; body: string; link_url: string | null; image_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_announcements').select('id, title, body, link_url, image_url').eq('active', true).order('sort_order');
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Événements</h1>
        <p className="text-sm text-slate-500 mt-1">Publications et temps forts (évoluera vers un agenda dédié)</p>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 text-sm">
            Aucun événement publié pour le moment.
          </div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {items.map((a) => (
              <article key={a.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {a.image_url && <img src={a.image_url} alt="" className="w-full h-44 object-cover" />}
                <div className="p-4">
                  <p className="font-bold">{a.title}</p>
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{a.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
