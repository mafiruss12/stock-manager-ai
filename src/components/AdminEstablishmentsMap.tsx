import { useEffect, useRef, useState } from 'react';
import type { Establishment } from '@/lib/types';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';

type Props = {
  establishments: Establishment[];
};

declare global {
  interface Window {
    L?: any;
  }
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.leaflet = '1';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Impossible de charger la carte'));
    document.body.appendChild(script);
  });
}

export default function AdminEstablishmentsMap({ establishments }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const withGps = establishments.filter(
    (e) => e.latitude != null && e.longitude != null && !Number.isNaN(Number(e.latitude)) && !Number.isNaN(Number(e.longitude)),
  );
  const withoutGps = establishments.filter((e) => !withGps.includes(e));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }
        const center: [number, number] =
          withGps.length > 0
            ? [Number(withGps[0].latitude), Number(withGps[0].longitude)]
            : [5.36, -4.008]; // Abidjan défaut
        const map = L.map(mapRef.current).setView(center, withGps.length ? 12 : 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        const bounds: any[] = [];
        withGps.forEach((e) => {
          const lat = Number(e.latitude);
          const lng = Number(e.longitude);
          const marker = L.marker([lat, lng]).addTo(map);
          marker.bindPopup(
            `<strong>${escapeHtml(e.name)}</strong><br/>${escapeHtml(e.address || '')}<br/>
             <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">Google Maps</a>
             · <a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}" target="_blank" rel="noopener">OSM</a>`,
          );
          bounds.push([lat, lng]);
        });
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
        else if (bounds.length === 1) map.setView(bounds[0], 15);
        mapInstance.current = map;
        setReady(true);
        setTimeout(() => map.invalidateSize(), 200);
      } catch (err: any) {
        setError(err?.message || 'Erreur carte');
      }
    })();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [establishments.map((e) => `${e.id}:${e.latitude}:${e.longitude}`).join('|')]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
          <MapPin size={14} /> {withGps.length} avec GPS
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700">
          {withoutGps.length} sans position
        </span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div
        ref={mapRef}
        className="w-full h-[420px] rounded-2xl border border-stone-700 overflow-hidden bg-stone-900"
        style={{ zIndex: 0 }}
      />
      {!ready && !error && <p className="text-xs text-stone-500">Chargement de la carte…</p>}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-200">Établissements géolocalisés</h3>
        {withGps.length === 0 && (
          <p className="text-sm text-stone-500">
            Aucune position pour le moment. Les propriétaires doivent appuyer sur « Enregistrer ma position GPS » dans Paramètres.
          </p>
        )}
        {withGps.map((e) => {
          const lat = Number(e.latitude);
          const lng = Number(e.longitude);
          return (
            <div key={e.id} className="card flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-stone-100 truncate">{e.name}</p>
                <p className="text-xs text-stone-500 truncate">{e.address || '—'}</p>
                <p className="text-[11px] text-stone-500 font-mono">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                  {e.location_updated_at && (
                    <span className="ml-2 text-stone-600">
                      · {new Date(e.location_updated_at).toLocaleString('fr-FR')}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  className="btn-secondary text-xs inline-flex items-center gap-1"
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation size={14} /> Maps
                </a>
                <a
                  className="btn-ghost text-xs inline-flex items-center gap-1"
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} /> OSM
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {withoutGps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-400">Sans GPS ({withoutGps.length})</h3>
          <div className="grid gap-1 sm:grid-cols-2">
            {withoutGps.map((e) => (
              <div key={e.id} className="text-xs text-stone-500 px-2 py-1.5 rounded-lg bg-stone-900/60 border border-stone-800">
                {e.name}
                {e.address ? ` — ${e.address}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
