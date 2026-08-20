import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  buildReminderMessage,
  freeMailto,
  freeWhatsAppLink,
  hasDailyReportToday,
  isReportRequiredRole,
  todayISO,
} from '@/lib/dailyReportGate';
import { supabase } from '@/lib/supabase';

/**
 * Obligation rapport journalier + rappels gratuits (in-app, mailto, wa.me).
 * Pas d'API payante : SMS auto payant non inclus.
 */
export default function DailyReportGate() {
  const { member, activeEstablishment, effectiveRole } = useAuth();
  const location = useLocation();
  const [missing, setMissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);

  const role = String(effectiveRole || member?.role || '');
  const estId = activeEstablishment?.id || member?.establishment_id || null;
  const required = isReportRequiredRole(role);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!required || !estId) {
        setMissing(false);
        setChecking(false);
        return;
      }
      setChecking(true);
      const ok = await hasDailyReportToday(estId);
      if (!cancelled) {
        setMissing(!ok);
        setChecking(false);
        // Notification in-app (1× / jour / user) — gratuit
        if (!ok && member?.user_id) {
          const key = `mm_report_nudge_${estId}_${todayISO()}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            const msg = buildReminderMessage({
              establishmentName: activeEstablishment?.name || 'Établissement',
              staffName: member.full_name || 'Équipe',
              date: todayISO(),
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
    run();
    return () => {
      cancelled = true;
    };
  }, [required, estId, member?.user_id, activeEstablishment?.name, location.pathname]);

  if (checking || !required || !missing || dismissed) return null;
  if (location.pathname.startsWith('/daily-report')) return null;

  const msg = buildReminderMessage({
    establishmentName: activeEstablishment?.name || 'Établissement',
    staffName: member?.full_name || 'Équipe',
    date: todayISO(),
  });

  const phone = (activeEstablishment as { phone?: string } | null)?.phone || (member as { phone?: string } | null)?.phone;
  const email = member?.email;

  return (
    <div className="mx-3 mt-3 sm:mx-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={22} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-100 text-sm sm:text-base">
            Rapport journalier obligatoire
          </p>
          <p className="text-stone-300 text-xs sm:text-sm mt-1">
            Aucune clôture enregistrée aujourd&apos;hui ({todayISO()}). Le propriétaire attend ce rapport.
            Complétez-le avant la fin du service.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              to="/daily-report"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-stone-950 text-sm font-medium"
            >
              <ClipboardCheck size={16} /> Faire le rapport
            </Link>
            {phone && (
              <a
                href={freeWhatsAppLink(String(phone), msg.waText)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-2 rounded-xl border border-emerald-500/40 text-emerald-200 text-sm"
              >
                WhatsApp rappel
              </a>
            )}
            {email && (
              <a
                href={freeMailto(email, msg.mailSubject, msg.mailBody)}
                className="inline-flex items-center px-3 py-2 rounded-xl border border-stone-600 text-stone-200 text-sm"
              >
                E-mail rappel
              </a>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="inline-flex items-center px-3 py-2 rounded-xl text-stone-400 text-sm hover:text-stone-200"
            >
              Plus tard
            </button>
          </div>
          <p className="text-[11px] text-stone-500 mt-2">
            Canaux gratuits : notification app + WhatsApp (wa.me) + e-mail (mailto). SMS auto payant non inclus.
          </p>
        </div>
        <button type="button" className="text-stone-500 hover:text-stone-300" onClick={() => setDismissed(true)} aria-label="Fermer">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
