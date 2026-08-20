import { supabase } from '@/lib/supabase';

/** Rôles obligés de faire le rapport journalier (hors propriétaire / admin plateforme) */
export const REPORT_REQUIRED_ROLES = ['manager', 'cashier', 'employee'] as const;

export function isReportRequiredRole(role: string | null | undefined): boolean {
  return REPORT_REQUIRED_ROLES.includes((role || '') as (typeof REPORT_REQUIRED_ROLES)[number]);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
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

/** Message de rappel multi-canal (gratuit : app + WhatsApp link + mailto) */
export function buildReminderMessage(opts: {
  establishmentName: string;
  staffName: string;
  date: string;
}): { title: string; body: string; waText: string; mailSubject: string; mailBody: string } {
  const title = `Rapport journalier obligatoire — ${opts.date}`;
  const body =
    `Bonjour ${opts.staffName},\n\n` +
    `Le rapport journalier de « ${opts.establishmentName} » n'est pas encore enregistré pour le ${opts.date}.\n` +
    `Merci de le compléter dans Stock Manager AI (menu Rapport du jour / Clôture).\n\n` +
    `C'est obligatoire pour le suivi du propriétaire.`;
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
  if (d.startsWith('0') && d.length === 10) d = '225' + d.slice(1);
  if (!d.startsWith('225') && d.length === 10) d = '225' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function freeMailto(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
