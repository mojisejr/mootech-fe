# `features/` — feature-based structure (MuMate v2)

MuMate v2 is organised by **feature**, not by file-type. Each feature owns its whole vertical slice
so a screen's UI, its client state, and its data access live together and can be reasoned about (and
deleted) as one unit.

## Convention

```
features/<feature>/
├── components/   # React components specific to this feature (feature UI)
├── hooks/        # client hooks (data-fetching, local state) for this feature
└── api/          # client-side API callers / BFF wrappers this feature uses
```

- **Reuse, don't rewrite.** Shared logic stays in `lib/` (auth / compute / elements / personalization)
  and shared UI primitives in `components/ui/` (the v3 design-system tokens). Features *compose* those;
  they never fork them. In particular the auth machine in `lib/auth` is fragile (login-loop history) —
  **wrap it, never rewrite it.**
- **Pages are thin.** `pages/v2/*` files only run the gate check (`getServerSideProps`) and mount a
  feature component. No business logic in pages.
- **Everything under `/v2` is behind the preview gate** (`V2_PREVIEW_KEY`, see `middleware.ts` /
  `lib/v2/gate.ts`). Fail-closed: no key configured = the whole surface is hidden.

## Phase 0 (this scaffold)

`features/v2-shell/` — the app shell only: `AppShell` (layout + bottom `Menubar`), the preview
`V2GateForm`, and a `PlaceholderScreen` for tabs with no flow yet. Real feature slices
(auth/onboarding, home/calculator, service, calendar, …) arrive in Phase B, each as its own
`features/<feature>/` folder. Universal design-system components (Button variants, Input fix, etc.)
come from Lamun's parallel PR and land in `components/ui/`.
