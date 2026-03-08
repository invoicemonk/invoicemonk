

# Fix Tawk.to Widget: Hide by Default, Open Only on Demand

## Problem
The Tawk.to chat widget loads with a persistent bubble and pre-chat messages ("Hi! How can we help you?", "I have a question") that blend into the app UI and obstruct interactions.

## Solution
Hide the Tawk.to widget by default and only show it when the user clicks "Contact Support" in the sidebar. The widget opens maximized, and when the user closes it, it hides again.

## Changes

### 1. `src/components/TawkTo.tsx`
- Set `window.Tawk_API = window.Tawk_API || {}` **before** loading the script
- Set `window.Tawk_API.onLoad` to call `window.Tawk_API.hideWidget()` immediately on load — this prevents the bubble from ever appearing
- Add a `customStyle` configuration to minimize visual interference if the widget does briefly flash

### 2. `src/hooks/use-tawk-identity.ts`
- Update the `Window["Tawk_API"]` type declaration to include `minimize` and `maximize` methods (already has some)
- After `setAttributes`, still call `hideWidget()` to ensure the widget stays hidden after identity injection

### 3. `src/components/app/BusinessSidebar.tsx` & `src/components/admin/AdminSidebar.tsx`
- Update `openSupportChat` to first call `showWidget()` then `maximize()` — since the widget is hidden by default, it needs to be shown before maximizing
- Add an event listener via `Tawk_API.onChatMinimized` to re-hide the widget when the user closes the chat

### Summary
| File | Change |
|------|--------|
| `TawkTo.tsx` | Hide widget on load via `onLoad → hideWidget()` |
| `use-tawk-identity.ts` | Keep widget hidden after identity set |
| `BusinessSidebar.tsx` | `showWidget()` + `maximize()`; re-hide on minimize |
| `AdminSidebar.tsx` | Same as BusinessSidebar |

