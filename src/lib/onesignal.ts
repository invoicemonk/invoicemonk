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

export function addTags(tags: Record<string, string>): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.User.addTags(tags);
  });
}

export function tagUser(
  userId: string,
  lastLoginDate: string,
  invoicesCreated: number
): void {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    await OneSignal.login(userId);
    await OneSignal.User.addTags({
      user_id: userId,
      last_login_date: lastLoginDate,
      invoices_created: String(invoicesCreated),
    });
  });
}
