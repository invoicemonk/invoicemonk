import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Replace with your GA4 Measurement ID
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

// Declare gtag on window
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 * @param eventName - Name of the event (e.g., 'invoice_created', 'subscription_upgraded')
 * @param eventParams - Optional parameters to send with the event
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
}

/**
 * Track a page view manually (useful for SPAs)
 * @param path - The page path to track
 * @param title - Optional page title
 */
export function trackPageView(path: string, title?: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: title,
    });
  }
}

/**
 * Hook to automatically track page views on route changes
 * Should be used once at the app root level
 */
export function useGoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView(location.pathname + location.search);
  }, [location]);
}

/**
 * Get the GA Measurement ID (for verification/debugging)
 */
export function getGAMeasurementId() {
  return GA_MEASUREMENT_ID;
}
