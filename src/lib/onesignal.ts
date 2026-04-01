declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
  }
}

export function initOneSignal(): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: "816bc883-5336-48be-aad8-2f8b17574d8c",
        allowLocalhostAsSecureOrigin: true,
      });
      console.log('[OneSignal] Initialized successfully');
    } catch (e) {
      console.warn('[OneSignal] Init failed:', e);
    }
  });
}

export function loginUser(userId: string): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.login(userId);
      if (!OneSignal.Notifications.permission) {
        await OneSignal.Notifications.requestPermission();
      }
      console.log('[OneSignal] User logged in:', userId);
    } catch (e) {
      console.warn('[OneSignal] Login failed:', e);
    }
  });
}

export function logoutUser(): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.logout();
      console.log('[OneSignal] User logged out');
    } catch (e) {
      console.warn('[OneSignal] Logout failed:', e);
    }
  });
}

export function addTags(tags: Record<string, string>): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.User.addTags(tags);
      console.log('[OneSignal] Tags added:', tags);
    } catch (e) {
      console.warn('[OneSignal] addTags failed:', e);
    }
  });
}
