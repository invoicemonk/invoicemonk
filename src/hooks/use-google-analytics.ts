import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// GA4 Measurement ID
const GA_MEASUREMENT_ID = 'G-TG0HV25RME';

// Declare gtag on window
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Route to page title mapping
const routeTitles: Record<string, string> = {
  // Auth pages
  '/login': 'Login',
  '/signup': 'Sign Up',
  '/verify-email': 'Verify Email',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
  
  // Dashboard pages
  '/dashboard': 'Dashboard',
  '/invoices': 'Invoices',
  '/invoices/new': 'Create Invoice',
  '/credit-notes': 'Credit Notes',
  '/clients': 'Clients',
  '/reports': 'Reports',
  '/analytics': 'Analytics',
  '/audit-logs': 'Audit Logs',
  '/business-profile': 'Business Profile',
  '/billing': 'Billing & Plans',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
  
  // Admin pages
  '/admin': 'Admin Dashboard',
  '/admin/users': 'Admin - Users',
  '/admin/businesses': 'Admin - Businesses',
  '/admin/invoices': 'Admin - Invoices',
  '/admin/audit-logs': 'Admin - Audit Logs',
  '/admin/billing': 'Admin - Billing',
  '/admin/country-modules': 'Admin - Country Modules',
  '/admin/retention-policies': 'Admin - Retention Policies',
  '/admin/templates': 'Admin - Templates',
  '/admin/system': 'Admin - System',
  
  // Legal/Docs
  '/legal/sla': 'Service Level Agreement',
  '/docs/api': 'API Documentation',
};

// Get title for dynamic routes (e.g., /invoices/:id)
function getPageTitle(pathname: string): string {
  // Check for exact match first
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }
  
  // Handle dynamic routes
  if (pathname.match(/^\/invoices\/[^/]+\/edit$/)) {
    return 'Edit Invoice';
  }
  if (pathname.match(/^\/invoices\/[^/]+$/)) {
    return 'Invoice Details';
  }
  if (pathname.match(/^\/clients\/[^/]+\/edit$/)) {
    return 'Edit Client';
  }
  if (pathname.match(/^\/clients\/[^/]+$/)) {
    return 'Client Details';
  }
  if (pathname.match(/^\/credit-notes\/[^/]+$/)) {
    return 'Credit Note Details';
  }
  if (pathname.match(/^\/org\/[^/]+\/dashboard$/)) {
    return 'Organization Dashboard';
  }
  if (pathname.match(/^\/org\/[^/]+\/invoices\/new$/)) {
    return 'Org - Create Invoice';
  }
  if (pathname.match(/^\/org\/[^/]+\/invoices\/[^/]+\/edit$/)) {
    return 'Org - Edit Invoice';
  }
  if (pathname.match(/^\/org\/[^/]+\/invoices\/[^/]+$/)) {
    return 'Org - Invoice Details';
  }
  if (pathname.match(/^\/org\/[^/]+\/invoices$/)) {
    return 'Org - Invoices';
  }
  if (pathname.match(/^\/org\/[^/]+\/clients$/)) {
    return 'Org - Clients';
  }
  if (pathname.match(/^\/org\/[^/]+\/reports$/)) {
    return 'Org - Reports';
  }
  if (pathname.match(/^\/org\/[^/]+\/team$/)) {
    return 'Org - Team';
  }
  if (pathname.match(/^\/org\/[^/]+\/audit-logs$/)) {
    return 'Org - Audit Logs';
  }
  if (pathname.match(/^\/org\/[^/]+\/settings$/)) {
    return 'Org - Settings';
  }
  if (pathname.match(/^\/invoice\/view\/[^/]+$/)) {
    return 'View Invoice';
  }
  if (pathname.match(/^\/verify\/invoice\/[^/]+$/)) {
    return 'Verify Invoice';
  }
  
  return 'Page';
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
 * Set user properties for authenticated users
 * @param userId - The user's ID
 * @param properties - Additional user properties
 */
export function setUserProperties(userId: string, properties?: Record<string, any>) {
  if (typeof window.gtag === 'function') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      user_id: userId,
    });
    if (properties) {
      window.gtag('set', 'user_properties', properties);
    }
  }
}

// Pre-defined event tracking helpers for type safety and consistency
export const gaEvents = {
  // Auth events
  signupStarted: () => trackEvent('signup_started'),
  signupCompleted: () => trackEvent('signup_completed'),
  loginSuccess: () => trackEvent('login_success'),
  
  // Invoice events
  invoiceCreated: (invoiceId: string) => 
    trackEvent('invoice_created', { invoice_id: invoiceId }),
  invoiceIssued: (invoiceId: string, amount?: number) => 
    trackEvent('invoice_issued', { invoice_id: invoiceId, amount }),
  invoiceSent: (invoiceId: string) => 
    trackEvent('invoice_sent', { invoice_id: invoiceId }),
  invoicePaid: (invoiceId: string, amount?: number) => 
    trackEvent('invoice_paid', { invoice_id: invoiceId, amount }),
  invoicePreviewed: (invoiceId?: string) => 
    trackEvent('invoice_previewed', { invoice_id: invoiceId }),
  pdfDownloaded: (invoiceId: string) => 
    trackEvent('pdf_downloaded', { invoice_id: invoiceId }),
  
  // Client events
  clientCreated: () => trackEvent('client_created'),
  
  // Subscription events
  subscriptionViewed: (currentPlan: string) => 
    trackEvent('subscription_viewed', { current_plan: currentPlan }),
  upgradeClicked: (fromPlan: string, toPlan: string) => 
    trackEvent('upgrade_clicked', { from_plan: fromPlan, to_plan: toPlan }),
  
  // Error events
  pageNotFound: (path: string, referrer?: string) => 
    trackEvent('page_not_found', { 
      page_path: path, 
      referrer: referrer || 'direct' 
    }),
};

/**
 * Hook to automatically track page views on route changes
 * and update document title for better analytics
 */
export function useGoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    const fullTitle = `${pageTitle} - Invoicemonk`;
    
    // Update browser tab title
    document.title = fullTitle;
    
    // Track page view with correct title
    trackPageView(location.pathname + location.search, fullTitle);
  }, [location]);
}

/**
 * Get the GA Measurement ID (for verification/debugging)
 */
export function getGAMeasurementId() {
  return GA_MEASUREMENT_ID;
}
