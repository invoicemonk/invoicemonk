

# Fix: Modern Template Header Clipped in PDF

## Problem

The modern template's colored header bar is being clipped at the top when printed to PDF. The `@page { margin: 12mm 15mm }` creates print margins that constrain all content, but the modern template's design intent is for the header to bleed to the page edges (or at minimum render fully).

## Root Cause

The shared `@page` rule applies uniform 12mm/15mm margins to all templates. For the modern template, this creates a visible gap above and beside the header bar, and when browsers render the print layout, the header can get partially cropped depending on the rendering engine.

## Fix

Override `@page` margins specifically for the modern template so the colored header bar extends fully:

**In `supabase/functions/generate-pdf/index.ts`:**

1. When `tplHeaderStyle === 'modern'`, inject a CSS override: `@page { margin: 0; }` — this eliminates the print margin so the header bar can bleed to the page edges.

2. Add internal padding to the modern template's content (everything after the header) so text doesn't sit at the page edges: wrap the body content below the header in a `div` with `padding: 0 15mm`.

3. Give the header bar itself horizontal padding to keep its text readable: keep the existing `padding: 20px 24px` but add `padding: 20mm 15mm 20px` so it has proper top spacing matching a natural top margin.

### Concrete change

In the `sharedCss` block (~line 496), make the `@page` rule dynamic:

```typescript
const pageCss = tplHeaderStyle === 'modern'
  ? '@page { size: A4; margin: 0; }'
  : '@page { size: A4; margin: 12mm 15mm; }';
```

Then in the modern body HTML (~line 643), update the header to include top/side padding that replaces the removed page margins, and wrap the remaining content in a padded container:

```html
<div style="background: ${color}; color: white; padding: 12mm 15mm 20px;">
  <!-- header content unchanged -->
</div>
<div style="padding: 0 15mm 12mm;">
  <!-- From/To cards, items, totals, footer -->
</div>
```

### Files to change
- `supabase/functions/generate-pdf/index.ts` — dynamic `@page` rule + modern template padding restructure

