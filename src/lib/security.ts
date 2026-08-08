/**
 * Sécurité côté client
 * - RLS + clé anon uniquement côté serveur/Supabase
 * - Rate-limit login, validation, anti-XSS basique
 */

const LOGIN_ATTEMPTS_KEY = 'mm_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 2 * 60 * 1000; // 2 minutes

interface AttemptState {
  count: number;
  lockedUntil: number;
}

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function writeAttempts(s: AttemptState) {
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(s));
}

export function getLoginLockRemaining(): number {
  const s = readAttempts();
  const left = s.lockedUntil - Date.now();
  return left > 0 ? left : 0;
}

export function registerLoginFailure(): { locked: boolean; remainingMs: number } {
  const s = readAttempts();
  if (s.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: s.lockedUntil - Date.now() };
  }
  const count = s.count + 1;
  if (count >= MAX_ATTEMPTS) {
    const next = { count: 0, lockedUntil: Date.now() + LOCK_MS };
    writeAttempts(next);
    return { locked: true, remainingMs: LOCK_MS };
  }
  writeAttempts({ count, lockedUntil: 0 });
  return { locked: false, remainingMs: 0 };
}

export function registerLoginSuccess() {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

export function isSafeLogin(login: string): boolean {
  const v = login.trim();
  if (v.length < 2 || v.length > 80) return false;
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const digits = v.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 15) return true;
  return /^[a-zA-Z0-9._-]{2,40}$/.test(v);
}

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= 6;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isSafeImageUrl(url: string): boolean {
  if (!url || !url.trim()) return true;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Sanitize message erreur (ne pas exposer détails internes) */
export function safeErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : (err as any)?.message || fallback;
  if (/password|invalid|credentials|email/i.test(msg)) return msg;
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Réseau indisponible. Mode hors ligne activé.';
  if (/JWT|token|session/i.test(msg)) return 'Session expirée. Reconnectez-vous.';
  return fallback;
}
