/**
 * Sécurité Stock Manager / Maquis
 * 1) Session : cookies Supabase — ne pas stocker access_token en localStorage custom
 * 2) Rôles admin : toujours re-vérifier depuis members (DB), jamais trust localStorage seul
 * 3) Rate-limit login
 * 4) Mots de passe robustes + HIBP
 * 5) Messages d'erreur non révélateurs
 */

const LOGIN_ATTEMPTS_KEY = 'mm_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

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

export function isStrongEnoughPassword(password: string): { ok: true } | { ok: false; reason: string } {
  if (password.length < 10) return { ok: false, reason: 'Mot de passe : minimum 10 caractères.' };
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { ok: false, reason: 'Mot de passe : majuscule et minuscule requises.' };
  }
  if (!/[0-9]/.test(password)) return { ok: false, reason: 'Mot de passe : au moins un chiffre.' };
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, reason: 'Mot de passe : au moins un caractère spécial.' };
  }
  return { ok: true };
}

export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\n').some((line) => line.split(':')[0]?.trim() === suffix);
  } catch {
    return false;
  }
}

/** Rôles privilégiés : à valider uniquement via row members Supabase */
export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
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

export function safeErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  const msg = typeof err === 'string' ? err : (err as { message?: string })?.message || fallback;
  if (/password|invalid|credentials|email/i.test(msg)) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (/network|fetch|Failed to fetch/i.test(msg)) return 'Réseau indisponible. Mode hors ligne activé.';
  if (/JWT|token|session/i.test(msg)) return 'Session expirée. Reconnectez-vous.';
  return fallback;
}
