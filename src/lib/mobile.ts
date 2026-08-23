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
 * Permissions natives : via APIs web dans la WebView Capacitor
 * (les prompts Android apparaissent quand le site demande géoloc / caméra / notifs).
 * Les plugins optionnels ne sont pas importés ici pour ne pas casser le build web.
 */
export async function requestNativePermissions(): Promise<Record<string, string>> {
  return { note: 'use_web_permissions_in_webview' };
}
