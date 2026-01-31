

# Plan: Google Analytics Integration

## Overview
Add Google Analytics 4 (GA4) tracking to monitor user activity, page views, and events across the application.

## What You'll Need
Before implementation, you'll need a **GA4 Measurement ID** from Google Analytics:
1. Go to [Google Analytics](https://analytics.google.com)
2. Create a property for your app (or use existing)
3. Get your Measurement ID (format: `G-XXXXXXXXXX`)

## Implementation

### 1. Add GA4 Script to `index.html`

Insert the Google Analytics gtag.js script in the document head with your Measurement ID.

### 2. Create Analytics Hook

Create `src/hooks/use-google-analytics.ts` to:
- Track page views automatically on route changes
- Provide helper functions for custom event tracking

### 3. Initialize in App

Add the analytics hook to your main `App.tsx` to start tracking page views across all routes.

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `index.html` | Modify | Add GA4 gtag.js script |
| `src/hooks/use-google-analytics.ts` | Create | Hook for page view and event tracking |
| `src/App.tsx` | Modify | Initialize analytics tracking |

## Features Included

- **Automatic Page View Tracking**: Every route change sends a page view event
- **Custom Event Tracking**: Helper function to track button clicks, form submissions, etc.
- **SPA Support**: Properly handles React Router navigation (not just initial page load)

## Example Usage

Once implemented, you can track custom events like:
```typescript
// Track invoice creation
trackEvent('invoice_created', { invoice_id: '123', amount: 5000 });

// Track subscription upgrade
trackEvent('subscription_upgraded', { plan: 'professional' });
```

## Privacy Considerations

The implementation will respect user privacy:
- No personally identifiable information (PII) sent to GA
- Can easily add cookie consent integration later if needed

## Estimated Effort
~15 minutes implementation time

