import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { trackEvent, trackPageView } from "@/hooks/use-google-analytics";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    
    // Update page title for GA
    document.title = "404 - Page Not Found - Invoicemonk";
    
    // Track page view with 404-specific title
    trackPageView(location.pathname, "404 - Page Not Found");
    
    // Fire custom event for easy filtering in GA4 reports
    trackEvent('page_not_found', {
      page_path: location.pathname,
      referrer: document.referrer || 'direct'
    });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
