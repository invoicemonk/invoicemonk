import { useEffect } from 'react';
import { clearTawkUserOpened, hideTawkUnlessOpened } from '@/lib/tawk-triggers';

export function TawkTo() {
  useEffect(() => {
    // Initialize Tawk_API before script loads to configure callbacks
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    const api = (window as any).Tawk_API;

    // The widget must stay hidden unless it was intentionally opened.
    // Tawk restores its own maximized/open state, so re-assert on every event.
    api.onLoad = function () {
      hideTawkUnlessOpened();
    };
    api.onChatMinimized = function () {
      clearTawkUserOpened();
      hideTawkUnlessOpened();
    };
    api.onChatEnded = function () {
      clearTawkUserOpened();
      hideTawkUnlessOpened();
    };
    api.onChatMaximized = function () {
      hideTawkUnlessOpened();
    };
    api.customStyle = {
      visibility: {
        desktop: { position: 'br', xOffset: 20, yOffset: 20 },
        mobile: { position: 'br', xOffset: 0, yOffset: 0 },
        bubble: { rotate: '0deg', xOffset: -20, yOffset: 0 },
      },
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/699086eff45fd51c3bd13d1e/1jhe8u6hu';
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    return () => {
      try { window.Tawk_API?.hideWidget(); } catch {}
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      setTimeout(() => {
        const tawkElements = document.querySelectorAll('[id^="tawk-"]');
        tawkElements.forEach((el) => el.remove());
        delete (window as any).Tawk_API;
        delete (window as any).Tawk_LoadStart;
      }, 100);
    };
  }, []);

  return null;
}
