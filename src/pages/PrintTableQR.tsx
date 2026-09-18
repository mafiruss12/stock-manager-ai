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

type TemplateId = 'affiche' | 'maquis' | 'elegant' | 'minimal' | 'festif';

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
    id: 'affiche',
    label: 'Affiche pro',
    desc: 'Orange Stock Manager · style vitrine',
    frame: 'from-orange-600 via-amber-500 to-orange-700',
    accent: '#FF7900',
    bg: '#fff7ed',
    text: '#7c2d12',
  },
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
  const [template, setTemplate] = useState<TemplateId>('affiche');
  const [selected, setSelected] = useState<string | 'all'>('all');
  const [phrase, setPhrase] = useState('Scannez pour commander votre boisson');
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
            <Sparkles size={14} /> Réglages QR Code
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
          className={`grid gap-4 ${
            template === 'affiche'
              ? 'grid-cols-1 max-w-md mx-auto affiche-mode'
              : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2 print:gap-6'
          }`}
          id="qr-print-area"
        >
          {visibleTables.map((t) => {
            const url = cardUrl(t.number);
            const qr = qrImageUrl(url, cfg, template === 'affiche' ? 320 : 240);
            return (
              <article
                key={t.id}
                className={`qr-print-card relative overflow-hidden rounded-2xl border shadow-lg print:break-inside-avoid print:shadow-none ${
                  template === 'affiche' ? 'border-orange-500/50' : 'border-stone-700'
                }`}
                style={{ background: tpl.bg, color: tpl.text }}
              >
                {template !== 'affiche' && (
                  <div className={`h-3 bg-gradient-to-r ${tpl.frame} print:h-2 qr-shimmer`} />
                )}
                {template === 'affiche' ? (
                  <div className="affiche-poster flex flex-col min-h-[420px] print:min-h-[260mm]">
                    {/* Bandeau haut type affiche pro */}
                    <div className="bg-gradient-to-b from-orange-600 to-[#FF7900] text-white px-4 pt-4 pb-5 text-center relative">
                      <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-orange-100/90">
                        Commande à table
                      </p>
                      <p className="mt-1 text-base sm:text-lg font-black leading-tight">
                        {estName || 'Stock Manager'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-orange-50/90 italic">
                        Scannez · choisissez · on vous sert
                      </p>
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt=""
                          className="mx-auto mt-2 w-14 h-14 rounded-full object-cover border-2 border-white/40 shadow-lg bg-white"
                        />
                      )}
                    </div>

                    {/* Corps : icônes + carte QR */}
                    <div className="flex-1 bg-[#fff7ed] px-3 py-4 flex gap-2 items-stretch">
                      <div className="hidden sm:flex print:flex flex-col justify-around py-2 w-14 shrink-0 text-center">
                        {[
                          { label: 'Menu' },
                          { label: 'Commande' },
                          { label: 'Service' },
                          { label: 'Suivi' },
                        ].map((x) => (
                          <div key={x.label} className="text-[9px] font-semibold text-orange-900/80">
                            <div className="mx-auto w-8 h-8 rounded-full border-2 border-orange-400/40 bg-white flex items-center justify-center mb-0.5 text-orange-700 text-[10px] font-black">
                              {x.label[0]}
                            </div>
                            {x.label}
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 flex flex-col items-center text-center">
                        <p className="text-3xl sm:text-4xl font-black text-orange-950 tracking-tight">
                          Table {t.number}
                        </p>
                        <p className="text-base sm:text-lg text-orange-950 mt-2 max-w-[260px] font-bold leading-snug">
                          {phrase || 'Scannez pour commander votre boisson'}
                        </p>

                        <div className="mt-3 w-full max-w-[280px] rounded-2xl bg-white border border-orange-500/20 shadow-xl p-3 sm:p-4">
                          <p className="text-[10px] font-bold text-orange-900 uppercase tracking-wide mb-2">
                            {estName || 'Stock Manager'}
                          </p>
                          <div className="mx-auto w-fit rounded-xl bg-white p-2 border border-stone-100">
                            <img
                              src={qr}
                              alt={`QR table ${t.number}`}
                              className="w-52 h-52 sm:w-56 sm:h-56 print:w-[55mm] print:h-[55mm]"
                              width={320}
                              height={320}
                            />
                          </div>
                          <div className="mt-3 rounded-xl bg-[#FF7900] text-white text-[11px] sm:text-xs font-bold py-2.5 px-2 flex items-center justify-center gap-1.5">
                            <QrCode size={14} className="shrink-0" />
                            SCANNEZ CE QR CODE
                          </div>
                          <p className="mt-1.5 text-[9px] text-orange-900/70 leading-snug">
                            pour passer commande · sans télécharger d&apos;application
                          </p>
                        </div>

                        <p className="mt-3 text-[10px] text-orange-900/60 font-medium print:hidden sm:block">
                          Une table libre ? Scannez et commandez !
                        </p>
                      </div>
                    </div>

                    {/* Pied de page valeurs */}
                    <div className="bg-white border-t border-orange-500/15 px-2 py-2.5 grid grid-cols-4 gap-1 text-center">
                      {[
                        'Rapide',
                        'Sans app',
                        'Menu live',
                        'Service',
                      ].map((lab) => (
                        <div key={lab}>
                          <p className="text-[9px] font-bold text-orange-900 uppercase tracking-wide">{lab}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-orange-700 text-orange-50 text-[10px] text-center py-2 font-semibold">
                      On est ensemble chez {estName || 'nous'} !
                    </div>

                    <button
                      type="button"
                      className="print:hidden text-xs py-2 underline text-orange-800/70"
                      onClick={() => void downloadPng(t.number)}
                    >
                      Télécharger PNG
                    </button>
                  </div>
                ) : (
                  <div className="p-5 flex flex-col items-center text-center gap-2">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/30 shadow"
                      />
                    )}
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                      {estName || 'Établissement'}
                    </p>
                    <p className="text-3xl font-black qr-pulse-text" style={{ color: tpl.accent }}>
                      Table {t.number}
                    </p>
                    <p className="text-sm font-medium opacity-80 max-w-[220px] qr-float">{phrase}</p>
                    <div className="relative my-2 qr-pulse-ring rounded-2xl p-2 bg-white">
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
                )}
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
            gap: 10mm;
            padding: 8mm;
          }
          #qr-print-area.affiche-mode {
            grid-template-columns: 1fr !important;
            gap: 0 !important;
            padding: 0 !important;
          }
          #qr-print-area.affiche-mode .qr-print-card {
            break-after: page;
            page-break-after: always;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            min-height: 270mm;
          }
          #qr-print-area.affiche-mode .qr-print-card:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .qr-shimmer, .qr-float, .qr-pulse-ring, .qr-pulse-text {
            animation: none !important;
            filter: none !important;
            box-shadow: none !important;
          }
          .print\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
