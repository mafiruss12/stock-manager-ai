/**
 * Intégration Capacitor (app native Android / iOS)
 */
export const isNative =
  typeof window !== 'undefined' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

export const platform: string =
  typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform
    ? (window as any).Capacitor.getPlatform()
    : 'web';

export async function initNativeApp(): Promise<void> {
  if (!isNative) return;
  try {
    const core = await import('@capacitor/core');
    if (!core.Capacitor.isNativePlatform()) return;
  } catch {
    return;
  }
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0c0a09' });
  } catch {
    /* */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* */
  }
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  } catch {
    /* */
  }
}

export async function getNativeOnlineStatus(): Promise<boolean> {
  if (!isNative) return typeof navigator !== 'undefined' ? navigator.onLine : true;
  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return status.connected;
  } catch {
    return navigator.onLine;
  }
}

/**
 * Permissions natives Android (si plugins présents).
 * Complète le flux web (devicePermissions.ts).
 */
export async function requestNativePermissions(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!isNative) return out;

  // Localisation
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perm = await Geolocation.requestPermissions();
    out.location = String(perm.location || perm.coarseLocation || 'prompt');
  } catch {
    out.location = 'plugin_absent';
  }

  // Caméra
  try {
    const { Camera } = await import('@capacitor/camera');
    const perm = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    out.camera = String(perm.camera || 'prompt');
    out.photos = String(perm.photos || 'prompt');
  } catch {
    out.camera = 'plugin_absent';
    out.photos = 'plugin_absent';
  }

  // Notifications (Android 13+)
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.requestPermissions();
    out.notifications = String(perm.display || 'prompt');
  } catch {
    out.notifications = 'plugin_absent';
  }

  return out;
}
