import { useEffect, useRef } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { useTour } from '@/contexts/TourContext';
import { WELCOME_TOUR_ID } from '@/lib/tours/registry';

/**
 * Starts the welcome tour once for a user who has never seen it.
 * Progress is stored per account, so it never re-runs on another device.
 */
export function WelcomeTourAutoStart() {
  const { startTour, hasSeen, progressLoaded, activeTourId } = useTour();
  const { currentBusiness } = useBusiness();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !progressLoaded || activeTourId) return;
    if (!currentBusiness) return;
    if ((currentBusiness as any).onboarding_step !== 'completed') return;
    if (hasSeen(WELCOME_TOUR_ID)) return;

    firedRef.current = true;
    const timer = window.setTimeout(() => startTour(WELCOME_TOUR_ID), 900);
    return () => window.clearTimeout(timer);
  }, [progressLoaded, activeTourId, currentBusiness, hasSeen, startTour]);

  return null;
}
