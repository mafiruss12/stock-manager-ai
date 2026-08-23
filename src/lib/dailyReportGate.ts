import { supabase } from '@/lib/supabase';

/** Rôles obligés de faire le rapport journalier (hors propriétaire / admin plateforme) */
export const REPORT_REQUIRED_ROLES = ['manager', 'cashier', 'employee'] as const;

export function isReportRequiredRole(role: string | null | undefined): boolean {
  return REPORT_REQUIRED_ROLES.includes((role || '') as (typeof REPORT_REQUIRED_ROLES)[number]);
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Liste des dates ISO des N derniers jours (du plus ancien au plus récent) */
export function lastNDates(n: number): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

export async function hasDailyReportToday(establishmentId: string, date = todayISO()): Promise<boolean> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('date', date)
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

/** Jours sans rapport sur la période (défaut 14 jours, y compris aujourd'hui) */
export async function getMissingReportDates(
  establishmentId: string,
  days = 14
): Promise<string[]> {
  const dates = lastNDates(days);
  if (!establishmentId || dates.length === 0) return dates;
  const from = dates[0];
  const { data, error } = await supabase
    .from('daily_reports')
    .select('date')
    .eq('establishment_id', establishmentId)
    .gte('date', from)
    .lte('date', dates[dates.length - 1]);
  if (error) return dates;
  const have = new Set((data || []).map((r: { date: string }) => String(r.date).slice(0, 10)));
  return dates.filter((d) => !have.has(d));
}

export function formatDateFr(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export function buildReminderMessage(opts: {
  establishmentName: string;
  staffName: string;
  date: string;
  missingDates?: string[];
}): { title: string; body: string; waText: string; mailSubject: string; mailBody: string } {
  const missing = opts.missingDates?.length
    ? `\nJours manquants : ${opts.missingDates.map(formatDateFr).join(', ')}.\n`
    : '';
  const title = `Rapport journalier obligatoire — ${opts.date}`;
  const body =
    `Bonjour ${opts.staffName},\n\n` +
    `Le rapport journalier de « ${opts.establishmentName} » n'est pas encore enregistré pour le ${opts.date}.\n` +
    missing +
    `Merci de le compléter dans Stock Manager AI (menu Rapport du jour).\n` +
    `Aucun jour ne doit être raté — c'est obligatoire pour le suivi du propriétaire.`;
  return {
    title,
    body,
    waText: `*Stock Manager AI*\n${title}\n\n${body}`,
    mailSubject: title,
    mailBody: body,
  };
}

export function freeWhatsAppLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '225' + d;
  if (!d.startsWith('225') && d.length === 10) d = '225' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function freeMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
