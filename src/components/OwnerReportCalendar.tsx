import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getReportStaff, todayISO, type ReportStaff } from '@/lib/dailyReportGate';

type ReportRow = {
  id: string;
  date: string;
  signature: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};

function monthMatrix(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function OwnerReportCalendar({ establishmentId }: { establishmentId: string }) {
  const today = todayISO();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [staff, setStaff] = useState<ReportStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const from = toISO(cursor.y, cursor.m, 1);
      const to = toISO(cursor.y, cursor.m, new Date(cursor.y, cursor.m + 1, 0).getDate());
      const [repRes, team] = await Promise.all([
        supabase
          .from('daily_reports')
          .select('id, date, signature, sent_at, created_at')
          .eq('establishment_id', establishmentId)
          .gte('date', from)
          .lte('date', to),
        getReportStaff(establishmentId),
      ]);
      if (cancelled) return;
      setReports((repRes.data as ReportRow[]) || []);
      setStaff(team);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, cursor.y, cursor.m]);

  const byDate = useMemo(() => {
    const map = new Map<string, ReportRow>();
    for (const r of reports) {
      const d = String(r.date).slice(0, 10);
      map.set(d, r);
    }
    return map;
  }, [reports]);

  /** Par employé : jours où sa signature / nom apparaît sur un rapport */
  const staffHistory = useMemo(() => {
    return staff.map((s) => {
      const name = (s.full_name || s.email || '').toLowerCase().trim();
      const done: string[] = [];
      const miss: string[] = [];
      const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = toISO(cursor.y, cursor.m, d);
        if (iso > today) continue; // futur ignoré
        const rep = byDate.get(iso);
        const sig = (rep?.signature || '').toLowerCase().trim();
        const matched =
          Boolean(rep) &&
          name &&
          (sig === name || sig.includes(name) || name.includes(sig));
        if (matched) done.push(iso);
        else if (!rep) miss.push(iso);
        else miss.push(iso); // rapport fait par quelqu'un d'autre = non pour cet employé
      }
      return { staff: s, done, miss };
    });
  }, [staff, byDate, cursor.y, cursor.m, today]);

  const weeks = monthMatrix(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    setCursor((c) => {
      const m = c.m - 1;
      return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
    });
  }
  function nextMonth() {
    setCursor((c) => {
      const m = c.m + 1;
      return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-stone-800 bg-stone-900/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-100 flex items-center gap-2">
            <ClipboardList className="text-sky-400" size={20} />
            Calendrier des points (rapports)
          </h2>
          <p className="text-xs text-stone-500">
            Vert = point effectué · Rouge = point non effectué · Gris = jour futur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="p-2 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-stone-200 capitalize min-w-[140px] text-center">{monthLabel}</span>
          <button type="button" onClick={nextMonth} className="p-2 rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 min-w-[280px] text-center text-xs">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d} className="py-1 text-stone-500 font-medium">
                  {d}
                </div>
              ))}
              {weeks.flat().map((day, i) => {
                if (day == null) return <div key={`e-${i}`} className="aspect-square" />;
                const iso = toISO(cursor.y, cursor.m, day);
                const isFuture = iso > today;
                const has = byDate.has(iso);
                const isToday = iso === today;
                let bg = 'bg-stone-800/50 text-stone-500';
                if (!isFuture) {
                  bg = has
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                    : 'bg-red-600/25 text-red-200 border border-red-500/40';
                }
                if (isToday) bg += ' ring-2 ring-amber-400/60';
                const rep = byDate.get(iso);
                return (
                  <div
                    key={iso}
                    title={
                      isFuture
                        ? iso
                        : has
                          ? `Point OK${rep?.signature ? ' — ' + rep.signature : ''}`
                          : 'Point non effectué'
                    }
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center ${bg}`}
                  >
                    <span className="font-semibold">{day}</span>
                    {!isFuture && (
                      <span className="text-[9px] opacity-80">{has ? 'OK' : '—'}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-stone-300">Historique par employé (mois affiché)</h3>
            {staff.length === 0 ? (
              <p className="text-xs text-stone-500">
                Aucun gérant / caissier / employé actif. Les jours verts = un point a été enregistré pour
                l&apos;établissement (voir signature sur le calendrier).
              </p>
            ) : (
              <ul className="space-y-2">
                {staffHistory.map(({ staff: s, done, miss }) => (
                  <li key={s.user_id} className="rounded-xl border border-stone-800 bg-stone-950/40 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-stone-100 font-medium">
                        {s.full_name || s.email || s.role}
                        <span className="text-xs text-stone-500 font-normal ml-2">{s.role}</span>
                      </p>
                      <p className="text-xs">
                        <span className="text-emerald-400">{done.length} fait</span>
                        {' · '}
                        <span className="text-red-400">{miss.length} manquant</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {done.slice(-12).map((d) => (
                        <span
                          key={d}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/25 text-emerald-200 border border-emerald-500/30"
                        >
                          {d.slice(8, 10)}/{d.slice(5, 7)}
                        </span>
                      ))}
                      {miss.slice(-12).map((d) => (
                        <span
                          key={d}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/25 text-red-200 border border-red-500/30"
                        >
                          {d.slice(8, 10)}/{d.slice(5, 7)}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      Vert = signature du rapport correspond à cet employé · Rouge = pas de point ou autre signature
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
