import { useEffect, useMemo, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks in-app navigation and browser tab close/refresh while a form has
 * unsaved changes. Returns the router blocker so a confirm dialog can be shown.
 */
export function useUnsavedChanges(when: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  return blocker;
}

/**
 * Compares the current form values against the snapshot captured on mount
 * (or against an explicitly provided baseline) to detect unsaved edits.
 */
export function useIsDirty<T>(current: T, baseline?: T) {
  const initialRef = useRef<string | null>(null);
  const serializedCurrent = JSON.stringify(current ?? null);
  const serializedBaseline = baseline === undefined ? null : JSON.stringify(baseline);

  if (initialRef.current === null) {
    initialRef.current = serializedBaseline ?? serializedCurrent;
  }

  return useMemo(() => {
    const base = serializedBaseline ?? initialRef.current;
    return base !== serializedCurrent;
  }, [serializedBaseline, serializedCurrent]);
}
