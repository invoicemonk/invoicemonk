import { useEffect } from 'react';

export function TawkTo() {
  useEffect(() => {
    // Initialize Tawk_API before script loads to configure onLoad
    (window as any).Tawk_API = (window as any).Tawk_API || {};
    window.Tawk_API.onLoad = function () {
      window.Tawk_API?.hideWidget();
    };
    window.Tawk_API.customStyle = {
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
      document.head.removeChild(script);
      const tawkElements = document.querySelectorAll('[id^="tawk-"]');
      tawkElements.forEach((el) => el.remove());
      delete (window as any).Tawk_API;
      delete (window as any).Tawk_LoadStart;
    };
  }, []);

  return null;
}
