import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { areaForPath } from '@/lib/product-registry';
import { trackProductEventOncePerSession } from '@/lib/product-tracking';

/** Records visits to client-only product areas (accounting, tax, reports, import). */
export function ProductRouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    const m = areaForPath(pathname);
    if (!m) return;
    trackProductEventOncePerSession(`${m.area}:${m.event}`, m.area, m.event, { workflow: m.workflow, milestone: m.milestone });
  }, [pathname]);
  return null;
}
