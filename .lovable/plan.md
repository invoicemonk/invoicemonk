

# Animated Hero Dashboard Preview Component

## What We're Building

A self-contained, animated dashboard mockup component (`HeroDashboardPreview`) designed to be embedded in the Invoicemonk marketing site hero section. It will show a miniaturized, non-interactive dashboard with animated elements that bring it to life: counting numbers, staggered card entrances, animated chart bars, and a live invoice notification toast.

## Component Design

**New file**: `src/components/public/HeroDashboardPreview.tsx`

A standalone component with no backend dependencies, using only static data and Framer Motion animations:

### Visual Elements (scaled-down dashboard mockup)
1. **Mini sidebar** — slim left bar with logo and nav icons (decorative only)
2. **4 stat cards** — Revenue, Outstanding, Paid, Drafts with animated counting numbers (count up from 0 on mount)
3. **Mini bar chart** — 6 bars that animate upward with staggered delays (pure CSS/framer-motion, no recharts dependency to keep it lightweight)
4. **Recent invoices list** — 3-4 rows that slide in sequentially
5. **Floating notification toast** — appears after ~2s showing "Invoice INV-007 paid — ₦1,250,000" with a green check, then fades

### Animations (Framer Motion)
- **Container**: Perspective tilt on mount (subtle 3D effect), slight floating hover
- **Stat cards**: Staggered fade-up entrance (0.1s delay each), numbers count up over 1.5s
- **Chart bars**: Each bar grows from height 0 to final height with spring physics, staggered 0.08s
- **Invoice rows**: Slide in from right, staggered 0.15s
- **Notification**: Slides in from top-right at 2.5s delay, auto-dismisses at 5s
- **Outer wrapper**: Subtle shadow glow pulse, rounded border with gradient

### Styling
- Wrapped in a rounded card with `overflow-hidden`, border, and shadow
- Uses existing design tokens (--primary, --card, --border, etc.)
- Responsive: scales proportionally, hidden details on mobile (show simplified version)
- Non-interactive (pointer-events-none on inner content to prevent confusion)

## Route / Integration

**New page**: `src/pages/demo/HeroPreview.tsx` — a standalone page at `/demo/hero-preview` that renders the component centered on a dark/gradient background, useful for previewing and for iframe embedding on the marketing site.

**App.tsx**: Add route `/demo/hero-preview` pointing to the new page.

## Files Changed

| File | Change |
|---|---|
| `src/components/public/HeroDashboardPreview.tsx` | **New** — main animated dashboard preview component |
| `src/pages/demo/HeroPreview.tsx` | **New** — standalone preview page |
| `src/App.tsx` | Add `/demo/hero-preview` route |

