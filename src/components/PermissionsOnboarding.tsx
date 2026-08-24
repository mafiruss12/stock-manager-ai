import { useEffect, useState } from 'react';
import {
  Bell,
  Camera,
  MapPin,
  HardDrive,
  Image,
  Mic,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  hasCompletedPermissionsOnboarding,
  markPermissionsOnboardingDone,
  requestAllDevicePermissions,
  type PermissionResult,
} from '@/lib/devicePermissions';

const ITEMS = [
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    desc: 'Rappels de point, messages, alertes stock',
  },
  {
    id: 'microphone',
    icon: Mic,
    title: 'Microphone',
    desc: 'Dictée des quantités, rapport vocal, mode patron',
  },
  {
    id: 'camera',
    icon: Camera,
    title: 'Appareil photo',
    desc: 'Photos produits, scan inventaire',
  },
  {
    id: 'location',
    icon: MapPin,
    title: 'Localisation',
    desc: 'Clients, livraisons et suivi terrain',
  },
  {
    id: 'gallery',
    icon: Image,
    title: 'Galerie',
    desc: 'Importer des images (demandé à l’usage)',
  },
  {
    id: 'storage',
    icon: HardDrive,
    title: 'Stockage',
    desc: 'Mode hors ligne plus fiable',
  },
] as const;

export default function PermissionsOnboarding() {
  const { member } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PermissionResult[] | null>(null);

  // Important : ouvrir quand le membre est chargé (sinon l’écran ne s’affiche jamais)
  useEffect(() => {
    if (!member) {
      setOpen(false);
      return;
    }
    if (!hasCompletedPermissionsOnboarding()) {
      setOpen(true);
    }
  }, [member]);

  // Écoute depuis Paramètres : window event
  useEffect(() => {
    function onForce() {
      setResults(null);
      setOpen(true);
    }
    window.addEventListener('mm-request-permissions', onForce);
    return () => window.removeEventListener('mm-request-permissions', onForce);
  }, []);

  if (!member || !open) return null;

  async function allowAll() {
    setLoading(true);
    setResults(null);
    try {
      // Les appels getUserMedia / Notification déclenchent les boîtes système
      const res = await requestAllDevicePermissions();
      setResults(res);
      markPermissionsOnboardingDone();
    } finally {
      setLoading(false);
    }
  }

  function skip() {
    markPermissionsOnboardingDone();
    setOpen(false);
  }

  function close() {
    markPermissionsOnboardingDone();
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[90] bg-stone-950/90 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15">
              <Shield className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Autoriser l’accès à l’appareil</h2>
              <p className="text-sm text-stone-400 mt-1">
                Appuyez sur <strong className="text-stone-200">Autoriser</strong> : le téléphone affichera
                une demande pour le micro, la caméra, la position et les notifications.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const r = results?.find(
                (x) => x.id === item.id || (item.id === 'gallery' && x.id === 'camera')
              );
              return (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-stone-800 bg-stone-950/50 px-3 py-2.5"
                >
                  <Icon className="text-stone-400 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-200">{item.title}</p>
                    <p className="text-xs text-stone-500">{item.desc}</p>
                    {r && (
                      <p
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          r.ok ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {r.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {r.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              className="btn-primary min-h-[48px] flex items-center justify-center gap-2"
              disabled={loading}
              onClick={() => void allowAll()}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Demandes en cours…
                </>
              ) : (
                'Autoriser les accès'
              )}
            </button>
            {results && (
              <button type="button" className="btn-secondary min-h-[44px]" onClick={close}>
                Continuer
              </button>
            )}
            {!results && (
              <button type="button" className="btn-ghost text-stone-500 text-sm" onClick={skip}>
                Plus tard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
