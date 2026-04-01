declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
  }
}

export function initOneSignal(): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.init({
      appId: "816bc883-5336-48be-aad8-2f8b17574d8c",
    });
  });
}

export function loginUser(userId: string): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.login(userId);
    if (!OneSignal.Notifications.permission) {
      await OneSignal.Notifications.requestPermission();
    }
  });
}

export function logoutUser(): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.logout();
  });
}

export function addTags(tags: Record<string, string>): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.User.addTags(tags);
  });
}
