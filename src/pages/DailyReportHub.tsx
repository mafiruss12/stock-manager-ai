import { useMemo, type ReactNode } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import {
  ClipboardCheck, ShoppingCart, Wallet, FileText,
} from 'lucide-react';
import DailyReportPage from '@/pages/DailyReport';
import Caisse from '@/pages/Caisse';
import ClotureZPage from '@/pages/ClotureZ';
import Documents from '@/pages/Documents';

type TabId = 'point' | 'caisse' | 'cloture' | 'docs';

const TABS: { id: TabId; label: string; icon: ReactNode; short: string }[] = [
  { id: 'point', label: 'Point du jour', short: 'Point', icon: <ClipboardCheck size={16} /> },
  { id: 'caisse', label: 'Caisse', short: 'Caisse', icon: <ShoppingCart size={16} /> },
  { id: 'cloture', label: 'Clôture Z', short: 'Clôture', icon: <Wallet size={16} /> },
  { id: 'docs', label: 'Devis & Factures', short: 'Docs', icon: <FileText size={16} /> },
];

function parseTab(raw: string | null): TabId {
  if (raw === 'caisse' || raw === 'pos') return 'caisse';
  if (raw === 'cloture' || raw === 'z') return 'cloture';
  if (raw === 'docs' || raw === 'documents' || raw === 'devis' || raw === 'facture') return 'docs';
  return 'point';
}

/**
 * Rapport du jour unifié :
 * Point boissons + Caisse + Clôture Z + Devis/Factures
 */
export default function DailyReportHub() {
  const [params, setParams] = useSearchParams();
  const tab = useMemo(() => parseTab(params.get('tab')), [params]);

  function setTab(id: TabId) {
    const next = new URLSearchParams(params);
    if (id === 'point') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display text-stone-100 flex items-center gap-2">
          <ClipboardCheck className="text-amber-400" size={26} />
          Rapport du jour
        </h1>
        <p className="text-sm text-stone-400 mt-1">
          Tout en un : point · caisse · clôture Z · devis & factures
        </p>
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-stone-950/90 backdrop-blur border-b border-stone-800">
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? 'bg-amber-500/20 text-amber-100 border-amber-500/40'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                {t.icon}
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[50vh]">
        {tab === 'point' && <DailyReportPage embedded />}
        {tab === 'caisse' && <Caisse embedded />}
        {tab === 'cloture' && <ClotureZPage embedded />}
        {tab === 'docs' && <Documents embedded />}
      </div>
    </div>
  );
}

/** Redirections anciennes URL → onglets du hub */
export function RedirectToReportTab({ tab }: { tab: TabId }) {
  return <Navigate to={`/daily-report?tab=${tab}`} replace />;
}
