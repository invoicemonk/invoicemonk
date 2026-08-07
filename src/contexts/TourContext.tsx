import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { toast } from '@/hooks/use-toast';
import { trackFunnel } from '@/lib/funnel-tracking';
import {
  TOURS,
  WELCOME_TOUR_ID,
  getTour,
  tourForPath,
  type TourDefinition,
  type TourStep,
} from '@/lib/tours/registry';
import { useSaveTourProgress, useTourProgress } from '@/hooks/use-tour-progress';

interface TourContextValue {
  /** Start a tour by id, navigating to its page first when needed. */
  startTour: (tourId: string) => void;
  /** Start the tour that matches the current page, if any. */
  startTourForCurrentPage: () => void;
  /** Tour available for the current route (null when none). */
  availableTour: TourDefinition | null;
  activeTourId: string | null;
  tours: TourDefinition[];
  /** True once we know which tours the user has already seen. */
  progressLoaded: boolean;
  hasSeen: (tourId: string) => boolean;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  startTourForCurrentPage: () => {},
  availableTour: null,
  activeTourId: null,
  tours: TOURS,
  progressLoaded: false,
  hasSeen: () => true,
});

export function useTour() {
  return useContext(TourContext);
}

function waitForElement(selector: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) return resolve(true);
    const started = Date.now();
    const tick = () => {
      if (document.querySelector(selector)) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

/** Click a selector if it exists — used by `beforeStep` helpers in the registry. */
export function clickSelector(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  el?.click();
}

const INTERACTIVE_HINT: Record<NonNullable<TourStep['advanceOn']>['type'], string> = {
  click: 'Go ahead and click it — the tour continues automatically.',
  input: 'Fill this in — the tour continues automatically.',
  appear: 'The tour continues as soon as it shows up.',
};

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { businessId } = useParams<{ businessId: string }>();
  const { data: progress, isSuccess: progressLoaded } = useTourProgress();
  const saveProgress = useSaveTourProgress();

  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const driverRef = useRef<Driver | null>(null);
  const lastIndexRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const pendingRef = useRef<string | null>(null);

  const availableTour = useMemo(() => tourForPath(location.pathname) ?? null, [location.pathname]);

  const hasSeen = useCallback(
    (tourId: string) => !!progress?.[tourId],
    [progress],
  );

  const runTour = useCallback(
    async (tour: TourDefinition) => {
      // Drop steps whose target isn't on the page so the tour never
      // highlights nothing or stalls on a plan-gated card. Steps that open
      // something themselves (`beforeStep`) or wait for the user
      // (`advanceOn`) are always kept — their target appears later.
      const resolved: TourStep[] = [];
      for (const [index, step] of tour.steps.entries()) {
        if (step.element && !step.beforeStep && !step.advanceOn) {
          // Only the first couple of steps are worth waiting for; later ones
          // should already be rendered.
          const present = await waitForElement(step.element, index === 0 ? 2500 : 300);
          if (!present) continue;
        }
        resolved.push(step);
      }

      if (resolved.length === 0) {
        toast({
          title: 'Tour unavailable here',
          description: 'This page has not finished loading yet. Try again in a moment.',
        });
        return;
      }

      driverRef.current?.destroy();
      setActiveTourId(tour.id);
      lastIndexRef.current = 0;
      trackFunnel('tour_started', { tour_id: tour.id });

      const detach = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
      };

      /** Prepare step `index` (run its opener, wait for its element). */
      const prepare = async (index: number) => {
        const step = resolved[index];
        if (!step) return;
        try {
          await step.beforeStep?.();
        } catch {
          /* opening a tab/dialog is best effort */
        }
        if (step.element) {
          await waitForElement(step.element, step.beforeStep || step.advanceOn ? 4000 : 500);
        }
      };

      const goNext = async (index: number) => {
        detach();
        const nextIndex = index + 1;
        if (nextIndex >= resolved.length) {
          driverRef.current?.destroy();
          return;
        }
        await prepare(nextIndex);
        driverRef.current?.moveNext();
      };

      const goPrev = async (index: number) => {
        detach();
        const prevIndex = index - 1;
        if (prevIndex < 0) return;
        await prepare(prevIndex);
        driverRef.current?.movePrevious();
      };

      /** Wire up the user action that auto-advances an interactive step. */
      const attachAdvance = (index: number) => {
        const step = resolved[index];
        if (!step?.advanceOn) return;
        const { type, selector } = step.advanceOn;
        const target = selector ?? step.element;
        if (!target) return;

        let done = false;
        const fire = () => {
          if (done) return;
          done = true;
          window.setTimeout(() => void goNext(index), 350);
        };

        if (type === 'appear') {
          void waitForElement(target, 120000).then((found) => {
            if (found) fire();
          });
          cleanupRef.current = () => {
            done = true;
          };
          return;
        }

        const handler = (event: Event) => {
          const node = event.target as HTMLElement | null;
          if (!node?.closest) return;
          if (!node.closest(target)) return;
          if (type === 'input') {
            const value = (node as HTMLInputElement).value;
            if (typeof value === 'string' && value.trim() === '') return;
          }
          fire();
        };

        const events = type === 'click' ? ['click'] : ['input', 'change'];
        events.forEach((name) => document.addEventListener(name, handler, true));
        cleanupRef.current = () => {
          done = true;
          events.forEach((name) => document.removeEventListener(name, handler, true));
        };
      };

      const steps = resolved.map((step, index) => ({
        element: step.element,
        popover: {
          title: step.title,
          description: step.advanceOn
            ? `${step.description}<span class="im-tour-hint">${INTERACTIVE_HINT[step.advanceOn.type]}</span>`
            : step.description,
          nextBtnText: step.advanceOn
            ? 'Skip step'
            : index === resolved.length - 1
              ? 'Done'
              : 'Next',
          onNextClick: () => void goNext(index),
          onPrevClick: () => void goPrev(index),
        },
      }));

      const instance = driver({
        showProgress: true,
        allowClose: true,
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: 'im-tour-popover',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        progressText: 'Step {{current}} of {{total}}',
        steps,
        onHighlighted: () => {
          // getActiveIndex() is only readable while the tour is alive, so we
          // mirror it here — after destroy() it returns undefined.
          const index = instance.getActiveIndex() ?? lastIndexRef.current;
          lastIndexRef.current = index;
          detach();
          attachAdvance(index);
        },
        onDestroyed: () => {
          detach();
          const activeIndex = lastIndexRef.current;
          const completed = activeIndex >= resolved.length - 1;

          setActiveTourId(null);
          driverRef.current = null;
          saveProgress.mutate({
            tourId: tour.id,
            status: completed ? 'completed' : 'skipped',
            lastStep: activeIndex,
          });
          trackFunnel(completed ? 'tour_completed' : 'tour_skipped', {
            tour_id: tour.id,
            last_step: activeIndex,
          });
          if (completed) {
            toast({
              title: 'Tour complete',
              description: 'Replay any tour from the help menu in the top bar.',
            });
          }
        },
      });

      driverRef.current = instance;
      await prepare(0);
      instance.drive();
    },
    [saveProgress],
  );

  const startTour = useCallback(
    (tourId: string) => {
      const tour = getTour(tourId);
      if (!tour) return;

      const targetPath =
        tour.path && businessId ? `/b/${businessId}${tour.path}` : null;

      if (targetPath && !location.pathname.startsWith(targetPath)) {
        // Navigate first; the effect below picks the tour up once the route
        // (and its content) has rendered.
        pendingRef.current = tour.id;
        navigate(targetPath);
        return;
      }

      void runTour(tour);
    },
    [businessId, location.pathname, navigate, runTour],
  );

  const startTourForCurrentPage = useCallback(() => {
    const tour = availableTour ?? getTour(WELCOME_TOUR_ID);
    if (tour) void runTour(tour);
  }, [availableTour, runTour]);

  // Resume a tour requested before a route change.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const tour = getTour(pending);
    if (!tour) {
      pendingRef.current = null;
      return;
    }
    const expected = tour.path && businessId ? `/b/${businessId}${tour.path}` : null;
    if (expected && !location.pathname.startsWith(expected)) return;
    pendingRef.current = null;
    void runTour(tour);
  }, [location.pathname, businessId, runTour]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      startTour,
      startTourForCurrentPage,
      availableTour,
      activeTourId,
      tours: TOURS,
      progressLoaded,
      hasSeen,
    }),
    [startTour, startTourForCurrentPage, availableTour, activeTourId, progressLoaded, hasSeen],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
