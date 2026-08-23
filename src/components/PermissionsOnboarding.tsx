import { useState } from 'react';
import {
  Bell,
  Camera,
  MapPin,
  HardDrive,
  Image,
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
    desc: 'Rappels de point, retards, messages importants',
  },
  {
    id: 'location',
    icon: MapPin,
    title: 'Localisation',
    desc: 'Position pour clients, livraisons et suivi terrain',
  },
  {
    id: 'camera',
    icon: Camera,
    title: 'Appareil photo',
    desc: 'Scanner stocks, photos de produits ou tickets',
  },
  {
    id: 'gallery',
    icon: Image,
    title: 'Galerie',
    desc: 'Importer des images depuis vos photos (demandé à l\'usage)',
  },
  {
    id: 'storage',
    icon: HardDrive,
    title: 'Stockage',
    desc: 'Mode hors ligne plus fiable et sauvegarde locale',
  },
] as const;

export default function PermissionsOnboarding() {
  const { member } = useAuth();
  const [open, setOpen] = useState(() => {
    if (!member) return false;
    return !hasCompletedPermissionsOnboarding();
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PermissionResult[] | null>(null);

  if (!member || !open) return null;

  async function allowAll() {
    setLoading(true);
    try {
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
      <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 shadow-2xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15">
              <Shield className="text-amber-400" size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Autorisations recommandées</h2>
              <p className="text-sm text-stone-400 mt-1">
                Pour mieux travailler (rapports, offline, photos, rappels), Stock Manager a besoin de
                certains accès sur votre téléphone.
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const r = results?.find((x) => x.id === item.id || (item.id === 'gallery' && x.id === 'camera'));
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
                      <p className={`text-xs mt-1 flex items-center gap-1 ${r.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {r.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {r.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] text-stone-500">
            Galerie et fichiers : le téléphone demandera l&apos;accès au moment d&apos;importer une photo.
            Vous pourrez modifier ces choix dans les réglages de l&apos;appareil.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void allowAll()}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
              {results ? 'Redemander les accès' : 'Autoriser les accès'}
            </button>
            {results ? (
              <button type="button" onClick={close} className="btn-secondary w-full">
                Continuer
              </button>
            ) : (
              <button type="button" onClick={skip} className="text-sm text-stone-500 hover:text-stone-300 py-2">
                Plus tard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
