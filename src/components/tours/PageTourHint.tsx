import { useEffect, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from '@/contexts/TourContext';

const DISMISS_KEY = 'im-tour-hint-dismissed';

function dismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Small, dismissible nudge offering the tour for the page you are on.
 * Shows once per tour: hidden after it is dismissed, or once the tour has
 * been seen on this account.
 */
export function PageTourHint() {
  const { availableTour, startTour, hasSeen, progressLoaded, activeTourId } = useTour();
  const [hidden, setHidden] = useState<string[]>(() => dismissed());

  useEffect(() => {
    setHidden(dismissed());
  }, [availableTour?.id]);

  if (!availableTour || !progressLoaded || activeTourId) return null;
  if (hasSeen(availableTour.id) || hidden.includes(availableTour.id)) return null;

  const dismiss = () => {
    const next = Array.from(new Set([...dismissed(), availableTour.id]));
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    setHidden(next);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
      <Compass className="h-4 w-4 text-primary shrink-0" />
      <p className="flex-1 text-sm text-muted-foreground">
        New here? Take the {availableTour.label.toLowerCase()} tour — {availableTour.description.toLowerCase()}.
      </p>
      <Button size="sm" variant="secondary" onClick={() => startTour(availableTour.id)}>
        Show me
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dismiss} aria-label="Dismiss tour hint">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
