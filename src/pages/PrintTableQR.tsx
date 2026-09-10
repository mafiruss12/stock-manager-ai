import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Printer, Download, Loader2, ArrowLeft, Sparkles, LayoutGrid,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  orderUrl,
  qrImageUrl,
  parseQrConfig,
  type QrConfig,
} from '@/lib/qrBranding';
import { EmptyState } from '@/components/ui';

type TableRow = { id: string; number: string; seats?: number; location?: string };

type TemplateId = 'maquis' | 'elegant' | 'minimal' | 'festif';

const TEMPLATES: {
  id: TemplateId;
  label: string;
  desc: string;
  frame: string;
  accent: string;
  bg: string;
  text: string;
}[] = [
  {
    id: 'maquis',
    label: 'Maquis ambre',
    desc: 'Orange / crème, ambiance bière',
    frame: 'from-amber-600 via-orange-500 to-amber-700',
    accent: '#f59e0b',
    bg: '#fffbeb',
    text: '#1c1917',
  },
  {
    id: 'elegant',
    label: 'Resto élégant',
    desc: 'Sombre & doré',
    frame: 'from-stone-900 via-stone-800 to-amber-900',
    accent: '#eab308',
    bg: '#1c1917',
    text: '#fafaf9',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Blanc, logo centré',
    frame: 'from-stone-200 via-white to-stone-100',
    accent: '#292524',
    bg: '#ffffff',
    text: '#1c1917',
  },
  {
    id: 'festif',
    label: 'Festif',
    desc: 'Couleurs vives',
    frame: 'from-fuchsia-600 via-orange-500 to-yellow-400',
    accent: '#db2777',
    bg: '#fdf4ff',
    text: '#1c1917',
  },
];

export default function PrintTableQR() {
  const { member, activeEstablishment } = useAuth();
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState('');
  const [estName, setEstName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [qrCfg, setQrCfg] = useState<QrConfig>({});
  const [template, setTemplate] = useState<TemplateId>('maquis');
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [phrase, setPhrase] = useState('Scannez pour commander');
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const estKey = slug || estId || '';
  const tpl = TEMPLATES.find((t) => t.id === template) || TEMPLATES[0];
  const cfg = useMemo(() => parseQrConfig(qrCfg), [qrCfg]);

  const load = useCallback(async () => {
    if (!estId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [tRes, eRes] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id, number, seats, location')
        .eq('establishment_id', estId)
        .order('number'),
      supabase
        .from('establishments')
        .select('name, slug, logo_url, cover_url, qr_config')
        .eq('id', estId)
        .maybeSingle(),
    ]);
    setTables((tRes.data as TableRow[]) || []);
    const e = eRes.data as any;
    if (e) {
      setEstName(String(e.name || ''));
      setSlug(String(e.slug || ''));
      setLogoUrl(e.logo_url || e.cover_url || null);
      setQrCfg(parseQrConfig(e.qr_config));
      if (e.qr_config?.title) setPhrase(String(e.qr_config.title));
      else if (e.qr_config?.welcome) setPhrase(String(e.qr_config.welcome).slice(0, 40));
    }
    setLoading(false);
  }, [estId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleTables = useMemo(() => {
    if (selected === 'all') return tables;
    return tables.filter((t) => t.id === selected);
  }, [tables, selected]);

  function cardUrl(tableNumber: string) {
    return orderUrl({
      origin,
      estKey,
      table: tableNumber,
      kiosk: cfg.kiosk_default !== false,
    });
  }

  function handlePrint() {
    window.print();
  }

  async function downloadPng(tableNumber: string) {
    setBusy(true);
    try {
      const url = cardUrl(tableNumber);
      const qr = qrImageUrl(url, cfg, 400);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // fond
      ctx.fillStyle = tpl.bg;
      ctx.fillRect(0, 0, 600, 800);
      // bandeau
      const grad = ctx.createLinearGradient(0, 0, 600, 80);
      grad.addColorStop(0, tpl.accent);
      grad.addColorStop(1, '#78716c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 100);

      ctx.fillStyle = tpl.id === 'elegant' ? '#fafaf9' : '#1c1917';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(estName.slice(0, 28) || 'Stock Manager', 300, 55);

      ctx.fillStyle = tpl.text;
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText(`Table ${tableNumber}`, 300, 200);

      ctx.font = '22px sans-serif';
      ctx.fillStyle = tpl.accent;
      ctx.fillText(phrase.slice(0, 36), 300, 250);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR load'));
        img.src = qr;
      });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(100, 280, 400, 400);
      ctx.drawImage(img, 120, 300, 360, 360);

      ctx.fillStyle = tpl.text;
      ctx.font = '16px sans-serif';
      ctx.fillText('Stock Manager · commande QR', 300, 760);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `qr-table-${tableNumber}-${(estName || 'etab').replace(/\s+/g, '-')}.png`;
      a.click();
    } catch (e) {
      console.warn(e);
      alert('Téléchargement PNG impossible — utilisez Imprimer / PDF du navigateur.');
    }
    setBusy(false);
  }

  async function downloadAllPng() {
    for (const t of visibleTables) {
      await downloadPng(t.number);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-stone-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!estId) {
    return (
      <EmptyState
        icon={<QrCode size={48} />}
        title="Aucun établissement"
        message="Sélectionnez un établissement pour imprimer les QR."
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <Link to="/tables" className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Tables
          </Link>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2">
            <Printer className="text-amber-400" /> Imprimer QR tables
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Design personnalisé · aperçu animé · PNG ou impression PDF
          </p>
        </div>
      </div>

      {/* Contrôles */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 print:hidden">
        <p className="text-xs font-semibold text-stone-400 uppercase">Modèle</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={`rounded-xl border p-3 text-left ${
                template === t.id
                  ? 'border-amber-500 bg-amber-500/15'
                  : 'border-stone-800 bg-stone-950'
              }`}
            >
              <div className={`h-2 rounded-full bg-gradient-to-r ${t.frame} mb-2`} />
              <p className="text-sm font-semibold text-stone-100">{t.label}</p>
              <p className="text-[10px] text-stone-500">{t.desc}</p>
            </button>
          ))}
        </div>

        <label className="block text-xs text-stone-400">
          Phrase sous le QR
          <input
            className="input-field mt-1"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            maxLength={48}
          />
        </label>

        <label className="block text-xs text-stone-400">
          Tables à imprimer
          <select
            className="input-field mt-1"
            value={selected}
            onChange={(e) => setSelected(e.target.value === 'all' ? 'all' : e.target.value)}
          >
            <option value="all">Toutes les tables ({tables.length})</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex items-center gap-2" onClick={handlePrint}>
            <Printer size={16} /> Imprimer / PDF
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            disabled={busy || !visibleTables.length}
            onClick={() => void downloadAllPng()}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            PNG haute résolution
          </button>
          <Link to="/menu-qr" className="btn-secondary text-sm flex items-center gap-1">
            <Sparkles size={14} /> Couleurs QR (Menu)
          </Link>
        </div>
        <p className="text-[11px] text-stone-500">
          Astuce : dans la boîte d’impression, choisissez « Enregistrer au format PDF ». Zone QR gardée lisible pour un bon scan.
        </p>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={48} />}
          title="Aucune table"
          message="Créez des tables d’abord, puis revenez imprimer les QR."
        />
      ) : (
        <div
          ref={printRef}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2 print:gap-6"
          id="qr-print-area"
        >
          {visibleTables.map((t) => {
            const url = cardUrl(t.number);
            const qr = qrImageUrl(url, cfg, 240);
            return (
              <article
                key={t.id}
                className={`qr-print-card relative overflow-hidden rounded-2xl border border-stone-700 shadow-lg print:break-inside-avoid print:shadow-none`}
                style={{ background: tpl.bg, color: tpl.text }}
              >
                {/* bandeau animé (écran seulement) */}
                <div
                  className={`h-3 bg-gradient-to-r ${tpl.frame} print:h-2 qr-shimmer`}
                />
                <div className="p-5 flex flex-col items-center text-center gap-2">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border border-black/10 qr-float"
                    />
                  )}
                  <p className="text-sm font-semibold opacity-80 truncate max-w-full">
                    {estName || 'Établissement'}
                  </p>
                  <p
                    className="text-4xl font-black tracking-tight qr-pulse-text"
                    style={{ color: tpl.accent }}
                  >
                    Table {t.number}
                  </p>
                  <p className="text-xs opacity-70">{phrase}</p>

                  <div className="relative mt-1 p-3 bg-white rounded-2xl shadow-inner qr-pulse-ring">
                    <img
                      src={qr}
                      alt={`QR table ${t.number}`}
                      className="w-48 h-48 print:w-44 print:h-44"
                      width={240}
                      height={240}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[10px] opacity-50 mt-1">
                    <QrCode size={12} />
                    <span>Commande sans app · scannez</span>
                  </div>

                  <button
                    type="button"
                    className="print:hidden text-xs mt-2 underline opacity-70"
                    onClick={() => void downloadPng(t.number)}
                  >
                    Télécharger PNG
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes qr-shimmer {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
          100% { filter: brightness(1); }
        }
        @keyframes qr-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes qr-pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.35); }
          50% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
        }
        @keyframes qr-pulse-text {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .qr-shimmer { animation: qr-shimmer 2.5s ease-in-out infinite; }
        .qr-float { animation: qr-float 3s ease-in-out infinite; }
        .qr-pulse-ring { animation: qr-pulse-ring 2s ease-out infinite; }
        .qr-pulse-text { animation: qr-pulse-text 2.2s ease-in-out infinite; }
        @media print {
          body * { visibility: hidden !important; }
          #qr-print-area, #qr-print-area * { visibility: visible !important; }
          #qr-print-area {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 12mm;
            padding: 8mm;
          }
          .qr-shimmer, .qr-float, .qr-pulse-ring, .qr-pulse-text {
            animation: none !important;
            filter: none !important;
            box-shadow: none !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
