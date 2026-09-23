# Frontend

React 19, TypeScript, Vite, Tailwind CSS 4, and shadcn/ui with Base UI primitives (`base-nova` in `components.json`).

## Organization

- `src/app`: application composition and navigation; secondary screens load on demand.
- `src/features`: screens and their domain-specific components, hooks, and helpers.
- `src/components/ui`: owned shadcn primitives. Add components with `npx shadcn@latest add <component>`; use the configured Base UI registry.
- `src/components/{brand,feedback,forms,layout}`: shared application components.
- `src/hooks`: shared request hooks. `useRows` deduplicates record requests with SWR; writes explicitly revalidate affected lists. The cache lives only for the authenticated workspace.
- `src/lib`: HTTP transport, dates, record display names, and `cn`.
- `src/types`: shared record contracts. The extensible legacy record payload remains dynamic; API-generated declarations remain in `src/generated`.
- `src/styles/globals.css`: brand/theme tokens and minimal element defaults. Component styling belongs in Tailwind utilities, with variants in UI primitives.

Use kebab-case filenames, PascalCase components, and `use` prefixes for hooks. Import modules directly through `@/`; avoid feature barrel exports. Keep state with the owning feature and extract independently useful sections rather than building one universal form. Production requests and preview invalidation live in `use-production.ts`; presentation lives in the form/preview components.

## Branding

The original SVG is vendored, unmodified, at `public/brand/faethon-logo.svg`, from [Faethon's official website](https://www.faethon.eu/faethon/img/faethon_logo.svg) (retrieved 2026-09-23). It has a cream fill and must sit on a burgundy surface.

Colors were read from the [website stylesheet](https://www.faethon.eu/faethon/css/style.css): burgundy `#4a1d1b`, cream `#f4e5d0`, tan `#dfbea1`, warm background `#f0ece7`, dark text `#1d1b17`, and muted burgundy `#936361`. The SVG's exact cream is `#f4e5cf`. Form borders and semantic success/error colors are application tokens, not claimed brand colors.

## Checks

Run `npm run build` then `npm test`. Playwright serves the built files through request interception with mocked API responses, so these checks do not start a dev server. Tests cover existing Greek workflows, permissions, accessible dialogs/tabs, branding, mobile layout, and stale preview rejection. Physical printing and backend integration require their existing separate checks.
