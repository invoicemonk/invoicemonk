# Design Tokens

Mirrors `../../src/index.css`. All values are semantic — never hardcode a
literal color, radius, or shadow in a component.

## Color tokens (light)

| Token | HSL | Hex | Use |
|---|---|---|---|
| background | `210 20% 99%` | `#FCFDFE` | Screen background |
| foreground | `222 47% 11%` | `#0F172A` | Body text |
| card | `0 0% 100%` | `#FFFFFF` | Card surfaces |
| card-foreground | `222 47% 11%` | `#0F172A` | Text on card |
| primary | `166 56% 26%` | `#1D6B5A` | **Brand teal** — primary buttons, links, active states |
| primary-foreground | `0 0% 100%` | `#FFFFFF` | Text on primary |
| secondary | `210 40% 98%` | `#F5F8FA` | Secondary buttons |
| muted | `210 40% 96%` | `#EEF2F5` | Muted backgrounds |
| muted-foreground | `215 16% 35%` | `#4B5563` | Muted / secondary text |
| accent | `166 76% 97%` | `#EAFBF5` | Soft teal tint (badge bg, hover) |
| accent-foreground | `166 56% 26%` | `#1D6B5A` | Text on accent |
| destructive | `0 84% 60%` | `#EF4444` | Destructive |
| warning | `38 92% 50%` | `#F59E0B` | Amber |
| success | `142 76% 36%` | `#16A34A` | Green |
| border | `214 32% 91%` | `#E2E8F0` | Dividers, input borders |
| ring | `166 56% 26%` | `#1D6B5A` | Focus ring |

## Color tokens (dark)

| Token | HSL |
|---|---|
| background | `222 47% 11%` |
| foreground | `214 32% 91%` |
| card | `222 40% 14%` |
| primary | `174 58% 39%` |
| secondary | `222 30% 18%` |

Full dark palette lives in `src/index.css` under `.dark`. Mirror it.

## Radius

```
--radius: 0.75rem   → 12px
```

Use as:
- `rounded-sm` = 6px
- `rounded-md` = 10px
- `rounded-lg` = 12px (default cards)
- `rounded-xl` = 16px (large cards / sheets)
- `rounded-full` = pill / avatars / FAB

## Shadows

| Token | Value |
|---|---|
| card-shadow | `0 4px 24px -4px hsl(222 47% 11% / 0.08)` |
| card-shadow-hover | `0 12px 32px -8px hsl(222 47% 11% / 0.15)` |
| glow-primary | `0 0 60px hsl(166 56% 26% / 0.2)` |

## Gradients

```
--hero-gradient: linear-gradient(135deg, hsl(166 56% 26%) 0%, hsl(174 58% 39%) 100%);
```

## Typography

Use system fonts by default (SF Pro on iOS, Roboto on Android). Do **not**
ship Inter/Poppins/etc unless the user requests custom fonts.

| Role | Size / weight |
|---|---|
| Display | 32 / 700 |
| H1 | 24 / 700 |
| H2 | 20 / 600 |
| H3 | 18 / 600 |
| Body | 16 / 400 |
| Body small | 14 / 400 |
| Caption | 12 / 500 (uppercase for labels) |
| Mono / numeric | tabular-nums where money is displayed |

## Spacing

Base unit: 4px. Follow Tailwind scale (`1 = 4px`, `2 = 8px`, `4 = 16px`,
`6 = 24px`, `8 = 32px`).

## Tailwind config (NativeWind)

```ts
// mobile/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        background: 'hsl(210 20% 99%)',
        foreground: 'hsl(222 47% 11%)',
        primary: {
          DEFAULT: 'hsl(166 56% 26%)',
          foreground: 'hsl(0 0% 100%)',
        },
        // ... mirror the rest from src/index.css
      },
      borderRadius: {
        lg: '12px',
        md: '10px',
        sm: '6px',
      },
    },
  },
};
```

Prefer semantic classes (`bg-primary`, `text-foreground`) over raw color
utilities so dark mode works automatically.
