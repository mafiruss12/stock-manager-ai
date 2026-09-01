/** Helpers vitrine publique — sans exposer données financières */

export type OpeningHours = {
  [day: string]: { open?: string; close?: string; closed?: boolean } | undefined;
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function slugify(name: string, id?: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const short = (id || '').replace(/-/g, '').slice(0, 6);
  return short ? `${base || 'etablissement'}-${short}` : base || 'etablissement';
}

/** Heuristique ouvert maintenant si opening_hours renseigné */
export function isOpenNow(hours: OpeningHours | null | undefined, now = new Date()): boolean | null {
  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) return null;
  const key = DAY_KEYS[now.getDay()];
  const slot = hours[key] || hours[String(now.getDay())];
  if (!slot) return null;
  if (slot.closed) return false;
  if (!slot.open || !slot.close) return null;
  const [oh, om] = slot.open.split(':').map(Number);
  const [ch, cm] = slot.close.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const o = oh * 60 + (om || 0);
  let c = ch * 60 + (cm || 0);
  if (c < o) c += 24 * 60; // overnight
  let m = mins;
  if (c >= 24 * 60 && m < o) m += 24 * 60;
  return m >= o && m <= c;
}

export function waLink(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const n = digits.startsWith('225') ? digits : digits.startsWith('0') ? `225${digits.slice(1)}` : `225${digits}`;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${n}${q}`;
}
