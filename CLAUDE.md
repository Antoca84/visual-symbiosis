# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server at http://localhost:8080
npm run build        # Production build (outputs to dist/)
npm run build:dev    # Development-mode build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm test             # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

**Run a single test file:**
```bash
npx vitest run src/test/example.test.ts
```

## Architecture

**Industrial Magic** is a static cinematic portfolio SPA (React 18 + Vite + TypeScript), deployed to GitHub Pages via `.github/workflows/deploy.yml`.

### Routing & Pages

`App.tsx` is the root — it sets up providers (React Query, TooltipProvider, Toaster/Sonner) and `BrowserRouter` with `basename={import.meta.env.BASE_URL}`. Routes are flat:

| Route | Page | Purpose |
|---|---|---|
| `/` | `Index` | Hero + Manifesto + Selected Work |
| `/about` | `About` | Studio statement + image overlay |
| `/contact` | `Contact` | Email copy interaction (no form) |
| `/lab` | `Lab` | Interactive ClothDemo canvas |
| `/lab2` | `Lab2` | Secondary experimental canvas |
| `*` | `NotFound` | 404 fallback |

Project detail pages (`/project/:slug`) are **not in App.tsx** — they were planned but the route is absent. `src/data/projects.ts` defines the 4 project objects (slug, title, subtitle, images, texts). If adding project routes, add the route in `App.tsx` and resolve slugs from that array.

### Component Structure

- `src/components/ui/` — shadcn-ui primitives (40+ components, mostly untouched boilerplate)
- `src/components/` — custom components used by pages
- `src/pages/` — route-level page components
- `src/data/projects.ts` — sole source of truth for portfolio project content
- `src/lib/utils.ts` — exports `cn()` (clsx + tailwind-merge) used everywhere for conditional classes

### Canvas / Physics Components

`ClothDemo.tsx` and `ClothDemo2.tsx` are custom Verlet-physics canvas simulations (cloth, particles, dissolve effects). They run their own `requestAnimationFrame` loops and manage canvas size via `ResizeObserver`. The dev HUD (debug panel) is gated on `window.location.hostname === "localhost"`.

### Animation Patterns

- **Scroll reveals**: wrap content in `<ScrollReveal>` — uses Framer Motion `useInView` with `once: true`
- **Staggered lists**: motion container with `staggerChildren` + motion item variants (see `DisciplinesSection`)
- **Page entry**: `motion.div` with `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`
- All animations use Framer Motion — do not introduce CSS keyframe animations for new interactive elements

## Design System

The site is **dark-first**. Never use white as a background. All colors are HSL CSS variables defined in `src/index.css :root`.

**Custom palette tokens** (used in Tailwind as `text-arterial`, `bg-bone`, etc.):
- `arterial` — deep red (biological accent)
- `bone` — warm off-white (primary text/accent)
- `deep-blue` — muted steel blue (secondary accent)
- `--radius: 0rem` — no border radius anywhere by design

**Typography:**
- Headlines (`h1`–`h6`): `font-serif` → Cormorant Garamond (400 weight)
- Body/UI: `font-mono` → Space Mono (base 13px, `letter-spacing: 0.02em`)
- Editorial spacing uses heavy tracking: `tracking-[0.2em]` to `tracking-[0.35em]`

**Layout philosophy** (from `.lovable/plan.md`): asymmetric compositions, generous negative space, cinematic scroll pacing. Avoid clean corporate grids. Text copy must remain poetic and interpretive — never procedural.

## Key Conventions

- Path alias `@/` maps to `src/` — always use it over relative imports
- `cn()` from `@/lib/utils` for all conditional className merging
- TypeScript is configured with `strict: false` — type assertions are acceptable but prefer proper typing
- No backend — React Query is wired up but unused; the site is fully static
- `useIsMobile()` hook (breakpoint: 768px) for responsive behavior in components
- The `lovable-tagger` dev plugin adds component metadata for the Lovable editor — don't remove it from `vite.config.ts`
