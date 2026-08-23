/**
 * Demandes d'accès appareil (web + préparation native Capacitor)
 */

const STORAGE_KEY = 'mm_permissions_onboarding_v1';

export type PermissionId = 'notifications' | 'location' | 'camera' | 'storage';

export type PermissionResult = {
  id: PermissionId;
  ok: boolean;
  detail: string;
};

export function hasCompletedPermissionsOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPermissionsOnboardingDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* */
  }
}

/** Notifications navigateur / PWA */
export async function requestNotifications(): Promise<PermissionResult> {
  if (typeof Notification === 'undefined') {
    return { id: 'notifications', ok: false, detail: 'Non supporté sur cet appareil' };
  }
  try {
    if (Notification.permission === 'granted') {
      return { id: 'notifications', ok: true, detail: 'Déjà autorisé' };
    }
    if (Notification.permission === 'denied') {
      return { id: 'notifications', ok: false, detail: 'Refusé — activez dans les réglages du téléphone' };
    }
    const res = await Notification.requestPermission();
    return {
      id: 'notifications',
      ok: res === 'granted',
      detail: res === 'granted' ? 'Autorisé' : 'Refusé',
    };
  } catch (e) {
    return { id: 'notifications', ok: false, detail: String(e) };
  }
}

/** Localisation GPS */
export async function requestLocation(): Promise<PermissionResult> {
  if (!navigator.geolocation) {
    return { id: 'location', ok: false, detail: 'GPS non disponible' };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ id: 'location', ok: true, detail: 'Localisation autorisée' }),
      (err) =>
        resolve({
          id: 'location',
          ok: false,
          detail: err.code === 1 ? 'Refusé par l\'utilisateur' : err.message || 'Erreur GPS',
        }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  });
}

/** Caméra (déclenche le prompt navigateur / APK) */
export async function requestCamera(): Promise<PermissionResult> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { id: 'camera', ok: false, detail: 'Caméra non disponible dans ce navigateur' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return { id: 'camera', ok: true, detail: 'Caméra autorisée' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { id: 'camera', ok: false, detail: msg.includes('denied') || msg.includes('NotAllowed') ? 'Refusé' : msg };
  }
}

/**
 * Stockage persistant (PWA) — limite l'éviction du cache offline.
 * Galerie / fichiers : le système demande l'accès au moment d'ouvrir un fichier photo.
 */
export async function requestStorage(): Promise<PermissionResult> {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (already) {
        return { id: 'storage', ok: true, detail: 'Stockage déjà persistant' };
      }
      const ok = await navigator.storage.persist();
      return {
        id: 'storage',
        ok,
        detail: ok
          ? 'Stockage persistant activé (offline plus fiable)'
          : 'Non accordé — le cache peut être effacé par le système',
      };
    }
    return { id: 'storage', ok: true, detail: 'Stockage local disponible' };
  } catch (e) {
    return { id: 'storage', ok: false, detail: String(e) };
  }
}

/** Enchaîne les demandes (ordre pensé pour l'UX mobile) */
export async function requestAllDevicePermissions(): Promise<PermissionResult[]> {
  const results: PermissionResult[] = [];
  results.push(await requestNotifications());
  results.push(await requestLocation());
  results.push(await requestCamera());
  results.push(await requestStorage());
  // Sur APK Capacitor : demander aussi les permissions natives
  try {
    const { isNative, requestNativePermissions } = await import('./mobile');
    if (isNative) {
      const native = await requestNativePermissions();
      if (native.location && native.location !== 'plugin_absent') {
        results.push({
          id: 'location',
          ok: native.location === 'granted',
          detail: 'Natif: ' + native.location,
        });
      }
      if (native.camera && native.camera !== 'plugin_absent') {
        results.push({
          id: 'camera',
          ok: native.camera === 'granted',
          detail: 'Natif: ' + native.camera + (native.photos ? ' / photos ' + native.photos : ''),
        });
      }
      if (native.notifications && native.notifications !== 'plugin_absent') {
        results.push({
          id: 'notifications',
          ok: native.notifications === 'granted',
          detail: 'Natif: ' + native.notifications,
        });
      }
    }
  } catch {
    /* web only */
  }
  return results;
}

/** Notification locale de test si autorisé */
export function sendTestNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    /* */
  }
}
