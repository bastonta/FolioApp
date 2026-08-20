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

  // 2. Tauri Window Fullscreen API (Desktop / Tauri mobile window)
  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => {
      getCurrentWindow().setFullscreen(!visible).catch(() => {});
    })
    .catch(() => {});

  // 3. Web Fullscreen API fallback (Browsers / PWA)
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
