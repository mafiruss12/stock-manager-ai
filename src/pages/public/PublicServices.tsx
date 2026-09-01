import { useState } from 'react';
import { Camera, Music, PartyPopper, Utensils, Truck, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import PublicLayout from '@/components/public/PublicLayout';
import AuthModal, { AuthMode } from '@/components/public/AuthModal';

const SERVICES = [
  { icon: Utensils, title: 'Traiteur & restauration', text: 'Menus événements, cocktails, buffets.' },
  { icon: Music, title: 'DJ & animation', text: 'Soirées, mariages, corporate.' },
  { icon: Camera, title: 'Photo & vidéo', text: 'Coverage pro pour vos événements.' },
  { icon: PartyPopper, title: 'Décoration', text: 'Scénographie et ambiance.' },
  { icon: Truck, title: 'Location matériel', text: 'Sono, tables, chapiteaux.' },
  { icon: Home, title: 'Hébergement', text: 'Partenaires et offres liées.' },
];

export default function PublicServices() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  return (
    <PublicLayout onOpenAuth={user ? undefined : (m) => { setAuthMode(m); setAuthOpen(true); }}>
      <AuthModal open={authOpen} mode={authMode} onClose={() => setAuthOpen(false)} onMode={setAuthMode} />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-sm text-slate-500 mt-1">
          Annuaire de prestataires — inscription « Je propose des services » pour apparaître ici (prochaine itération).
        </p>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                  <Icon size={20} />
                </div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-slate-500 mt-1">{s.text}</p>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
          className="mt-8 h-11 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
        >
          Proposer mes services
        </button>
      </div>
    </PublicLayout>
  );
}
