import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  buildReminderMessage,
  formatDateFr,
  freeMailto,
  freeWhatsAppLink,
  getMissingReportDates,
  isReportRequiredRole,
  todayISO,
} from '@/lib/dailyReportGate';
import { supabase } from '@/lib/supabase';

/**
 * Obligation rapport journalier + liste des jours manqués.
 * Employé / caissier / gérant : ne peuvent pas ignorer le jour en cours.
 */
export default function DailyReportGate() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const location = useLocation();
  const navigate = ();
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const [dismissedPast, setDismissedPast] = useState(false);

  const role = String(effectiveRole || member?.role || '');
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const required = isReportRequiredRole(role);
  const today = todayISO();
  const todayMissing = missingDates.includes(today);
  const pastMissing = missingDates.filter((d) => d !== today);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!required || !estId) {
        setMissingDates([]);
        setChecking(false);
        return;
      }
      setChecking(true);
      const missing = await getMissingReportDates(estId, 14);
      if (!cancelled) {
        setMissingDates(missing);
        setChecking(false);
        if (missing.length && member?.user_id) {
          const key = `mm_report_nudge_${estId}_${today}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            const msg = buildReminderMessage({
              establishmentName: activeEstablishment?.name || 'Établissement',
              staffName: member.full_name || 'Équipe',
              date: today,
              missingDates: missing,
            });
            await supabase.from('notifications').insert({
              user_id: member.user_id,
              title: msg.title,
              body: msg.body,
              message: msg.body,
              type: 'report_reminder',
              link: '/daily-report',
              read: false,
              action_label: 'Faire le rapport',
            });
          }
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [required, estId, member?.user_id, activeEstablishment?.name, location.pathname, today]);


  if (checking || !required || missingDates.length === 0) return null;
  if (location.pathname.startsWith('/daily-report')) return null;
  // Peut masquer uniquement les jours passés si aujourd'hui est fait
  if (!todayMissing && dismissedPast) return null;

  const msg = buildReminderMessage({
    establishmentName: activeEstablishment?.name || 'Établissement',
    staffName: member?.full_name || 'Équipe',
    date: today,
    missingDates,
  });

  const ownerPhone =
    (activeEstablishment as { phone?: string } | null)?.phone ||
    member?.phone ||
    '';

  return (
    <div className="mx-3 mt-2 sm:mx-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-sm text-amber-50 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-100 flex items-center gap-2">
            <ClipboardList size={16} /> Rapport journalier obligatoire
          </p>
          {todayMissing ? (
            <p className="text-amber-100/90 mt-1">
              Le point d&apos;aujourd&apos;hui ({formatDateFr(today)}) n&apos;est pas encore fait. Pensez à le faire vous-même chaque jour — c&apos;est obligatoire pour le suivi.
            </p>
          ) : (
            <p className="text-amber-100/90 mt-1">
              Des jours précédents n&apos;ont pas de rapport. Merci de régulariser si possible.
            </p>
          )}
          {pastMissing.length > 0 && (
            <p className="text-xs text-amber-200/80 mt-1">
              Jours manquants : {pastMissing.map(formatDateFr).join(' · ')}
              {todayMissing ? ` · + aujourd'hui` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/daily-report"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-stone-900 text-xs font-semibold"
        >
          Faire le rapport
        </Link>
        {ownerPhone && (
          <a
            href={freeWhatsAppLink(ownerPhone, msg.waText)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-100"
          >
            WhatsApp
          </a>
        )}
        {member?.email && (
          <a
            href={freeMailto(member.email, msg.mailSubject, msg.mailBody)}
            className="inline-flex px-3 py-1.5 rounded-lg border border-amber-500/40 text-xs text-amber-100"
          >
            E-mail
          </a>
        )}
        {!todayMissing && (
          <button
            type="button"
            className="text-xs text-amber-200/70 underline ml-auto"
            onClick={() => setDismissedPast(true)}
          >
            Masquer
          </button>
        )}
      </div>
    </div>
  );
}
