import { ThemeName } from '../types/reader';

const THEME_COLORS: Record<string, { bg: string; isDarkIcons: boolean }> = {
  light: { bg: '#ffffff', isDarkIcons: true },
  sepia: { bg: '#fbf0d9', isDarkIcons: true },
  solarized: { bg: '#fdf6e3', isDarkIcons: true },
  dark: { bg: '#1e1e1e', isDarkIcons: false },
  gray: { bg: '#2e3440', isDarkIcons: false },
};

/**
 * Detect if the app is currently running on a mobile device / environment
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Native Android Bridge (Tauri Android)
  if ((window as any).AndroidBridge) {
    return true;
  }

  // 2. User Agent check for mobile / tablet devices
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/android|avantgo|blackberry|iemobile|ipad|iphone|ipod|opera mini|palmsource|pocketpc|smartphone|tablet|up\.browser|up\.link|webos|windows ce|windows phone/i.test(ua)) {
    return true;
  }

  // 3. iPad / iOS 13+ detection (reports as Macintosh with touch points)
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }

  return false;
}

/**
 * Utility to control System UI / Status Bar (Clock & Battery) across platforms
 */

export function setStatusBarVisible(visible: boolean): void {
  // 1. Native Android via AndroidBridge Javascript Interface (Tauri Android)
  try {
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge && typeof androidBridge.setStatusBarVisible === 'function') {
      androidBridge.setStatusBarVisible(visible);
    }
  } catch (e) {
    console.warn('AndroidBridge error:', e);
  }

  // Fullscreen is only for mobile devices. On desktop, the window should stay as it was.
  if (!isMobileDevice()) {
    return;
  }

  // 2. Tauri Window Fullscreen API (Tauri mobile window)
  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => {
      getCurrentWindow().setFullscreen(!visible).catch(() => {});
    })
    .catch(() => {});

  // 3. Web Fullscreen API fallback (Mobile browsers / PWA)
  try {
    if (!visible) {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Web Fullscreen API error:', e);
  }
}

/**
 * Set status bar icon style (dark icons for light backgrounds, light icons for dark backgrounds)
 */
export function setStatusBarIconsDark(darkIcons: boolean): void {
  try {
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge && typeof androidBridge.setStatusBarIconsDark === 'function') {
      androidBridge.setStatusBarIconsDark(darkIcons);
    }
  } catch (e) {
    console.warn('AndroidBridge setStatusBarIconsDark error:', e);
  }
}

/**
 * Sync status bar color and text/icon appearance with the app's current theme
 */
export function setStatusBarTheme(theme: ThemeName | string): void {
  const themeInfo = THEME_COLORS[theme.toLowerCase()] || {
    bg: '#ffffff',
    isDarkIcons: !['dark', 'gray', 'black'].includes(theme.toLowerCase()),
  };

  // 1. Android Native status bar icons
  try {
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge) {
      if (typeof androidBridge.setStatusBarTheme === 'function') {
        androidBridge.setStatusBarTheme(theme);
      } else if (typeof androidBridge.setStatusBarIconsDark === 'function') {
        androidBridge.setStatusBarIconsDark(themeInfo.isDarkIcons);
      }
    }
  } catch (e) {
    console.warn('AndroidBridge setStatusBarTheme error:', e);
  }

  // 2. Web / Browser meta theme-color & color-scheme
  try {
    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeInfo.bg;

    let metaColorScheme = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (!metaColorScheme) {
      metaColorScheme = document.createElement('meta');
      metaColorScheme.name = 'color-scheme';
      document.head.appendChild(metaColorScheme);
    }
    metaColorScheme.content = themeInfo.isDarkIcons ? 'light' : 'dark';

    document.documentElement.style.colorScheme = themeInfo.isDarkIcons ? 'light' : 'dark';
  } catch (e) {
    console.warn('DOM theme meta update error:', e);
  }
}
