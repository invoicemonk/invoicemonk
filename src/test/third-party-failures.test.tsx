import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { TawkTo } from "@/components/TawkTo";
import { initOneSignal, loginUser } from "@/lib/onesignal";

describe("third-party integrations never break auth pages", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete (window as any).Tawk_API;
    delete (window as any).OneSignalDeferred;
  });

  it("TawkTo does not render or throw on auth routes", () => {
    window.history.pushState({}, "", "/login");
    const { container } = render(<TawkTo />);
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('script[src*="tawk.to"]')).toBeNull();
  });

  it("TawkTo injects chat lazily on app routes without blocking render", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/dashboard");
    render(<TawkTo />);
    expect(document.querySelector('script[src*="tawk.to"]')).toBeNull();
    vi.advanceTimersByTime(2_000);
    const script = document.querySelector('script[src*="tawk.to"]') as HTMLScriptElement | null;
    expect(script?.async).toBe(true);
    vi.useRealTimers();
  });

  it("OneSignal helpers swallow failures outside the production host", () => {
    expect(() => initOneSignal()).not.toThrow();
    expect(() => loginUser("user-1")).not.toThrow();
  });
});
