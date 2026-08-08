import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maquismanager.app',
  appName: 'Stock Manager AI',
  webDir: 'dist',
  server: {
    // APK charge toujours le site live (nouvelle adresse)
    url: 'https://stock-manager-ktp.vercel.app',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0c0a09',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#0c0a09',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0c0a09',
    },
  },
};

export default config;
