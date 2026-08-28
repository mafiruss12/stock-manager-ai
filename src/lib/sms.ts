/**
 * SMS Afrique — prêt pour Africa’s Talking (ou équivalent)
 * Sans clés : pas d’envoi, message d’aide clair.
 * Secrets uniquement en variables d’environnement serveur.
 */

export function isSmsConfigured(): boolean {
  return Boolean(
    (import.meta.env.VITE_AT_USERNAME as string | undefined)?.trim() &&
      (import.meta.env.VITE_AT_API_KEY as string | undefined)?.trim(),
  );
}

/**
 * Envoi SMS (à brancher via Edge Function en prod).
 * Frontend ne doit jamais contenir la clé secrète complète.
 */
export async function sendSmsPlaceholder(opts: {
  to: string;
  message: string;
}): Promise<{ ok: boolean; detail: string }> {
  if (!isSmsConfigured()) {
    return {
      ok: false,
      detail:
        'SMS non configuré. Ajoutez VITE_AT_USERNAME + fonction serveur Africa’s Talking, ou utilisez WhatsApp (gratuit).',
    };
  }
  // Appel futur : POST /api/sms
  return {
    ok: false,
    detail: `SMS prêt pour ${opts.to} — branchez /api/sms (Africa’s Talking). Message: ${opts.message.slice(0, 40)}…`,
  };
}

export function smsHelpText(): string {
  return [
    'SMS Afrique (optionnel) :',
    '1. Compte Africa’s Talking',
    '2. Clés en variables Vercel (serveur)',
    '3. Endpoint /api/sms',
    'En attendant : rappels via WhatsApp wa.me (gratuit).',
  ].join('\n');
}
