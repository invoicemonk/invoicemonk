import { useEffect } from 'react';

export function TawkTo() {
  useEffect(() => {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/699086eff45fd51c3bd13d1e/1jhe8u6hu';
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      // Clean up Tawk.to iframe/widget
      const tawkElements = document.querySelectorAll('[id^="tawk-"]');
      tawkElements.forEach((el) => el.remove());
      delete (window as any).Tawk_API;
      delete (window as any).Tawk_LoadStart;
    };
  }, []);

  return null;
}
