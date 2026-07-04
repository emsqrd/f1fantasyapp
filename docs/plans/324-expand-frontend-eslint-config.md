# 324 — Expand frontend ESLint config with type-checked and library rules

Issue: [#324](https://github.com/emsqrd/f1fantasyapp/issues/324)

Expand `web/`'s ESLint config from `tseslint.configs.recommended` to core + type-checked rules plus usage-matched library plugins, and give `e2e/` its first ESLint config. All packages verified against the live registry as ESLint-10-compatible.

## Approach

- **Severity posture: all rules land at `error`.** Each commit fixes its own violations so `web:lint` (and the pre-commit hook / CI) stays green. No `warn` tier, no "warn now, promote later" on-ramp — a non-blocking bug-catcher is one nobody fixes. The existing advisory `warn`s (`no-console`) stay as they are.
- **`recommendedTypeChecked`, not `strictTypeChecked`.** `strict`'s `no-unnecessary-condition` assumes `noUncheckedIndexedAccess`, which is **off** in `tsconfig.app.json`, so it would mis-flag index access.
- **Verification per commit:** `web:format:check`, `web:lint`, `web:build`, `web:test` all green (this is the pre-commit hook's own sequence). For the e2e commit, additionally `e2e:lint` green and the CI reorder correct. There are no new unit tests — for config work, a green lint/build *is* the test.

## Config decisions baked in

- **`js.configs.recommended`** added to the extends array (core rules like `no-constant-binary-expression`, `use-isnan`, `valid-typeof` that tseslint's preset does not include).
- **`eslint-config-prettier`** added **last** in the array (disables any formatting rules; Prettier + `@trivago/sort-imports` own formatting).
- **`projectService: true` + `tsconfigRootDir`** under `languageOptions.parserOptions` to power the type-checked rules. Coverage is already complete: `src/**` → `tsconfig.app.json`, `vite.config.ts` → `tsconfig.node.json`. JS config files (`eslint.config.js`, `prettier.config.js`) aren't matched by the `**/*.{ts,tsx}` block, so they aren't type-checked.
- **`@typescript-eslint/switch-exhaustiveness-check`** enabled explicitly — it ships with typescript-eslint but no preset turns it on.
- **`import-x/no-cycle` only** from `eslint-plugin-import-x`, with `eslint-import-resolver-typescript` wired via `settings['import-x/resolver-next']` — the default node resolver can't follow the `@/` alias, which is nearly every import in the codebase. Skip `import/order` — Prettier owns import ordering.
- **Testing-library + Vitest plugins scoped to test files** — a dedicated config block with `files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/setupTests.ts', 'src/tests/**/*.{ts,tsx}']` so their rules don't evaluate production code.
- Keep the existing `ignores` (`dist`, `coverage`, `src/components/ui` — vendored shadcn).
- Keep `react-hooks` as-is apart from the `exhaustive-deps` severity bump above.

### Drive-by cleanups (folded in, tracked on the issue)

- **Remove the custom `@typescript-eslint/no-unused-vars` block.** The preset already ships it at `error`; the `^_$` exemption is idle (grep-confirmed: no `catch (_)`, and the `(_, i)` callbacks pass on the default `after-used`). Removing it keeps the rule at `error` with defaults — a no-op on today's tree. Side effect going forward: an intentionally-ignored caught error is written `catch {`, not `catch (_)`.
- **Bump `react-refresh/only-export-components` `warn` → `error`** (keep `allowConstantExport: true` and the plugin registration). Its consequence is dev-only (a Fast Refresh full reload), but a non-blocking nudge protects nothing; the fix (split the non-component export out) is cheap and structurally good. Keep the plugin registration line — it's the rule's only activation.

### Deliberately excluded (see issue for full reasoning)

`eslint-plugin-unicorn` (curation cost), `eslint-plugin-sonarjs` (only unique bug-catch over `js.configs.recommended` is the low-frequency `no-all-duplicated-branches`; not worth a 3.6 MB dep + preset curation), `eslint-plugin-react` (no ESLint 10 support; moot under React 19's automatic JSX runtime), `eslint-plugin-jsx-a11y` (no ESLint 10 support — a **known, tracked gap** vs. the WCAG 2.1 AA goal, not an oversight), `eslint-plugin-jest-dom` (marginal over testing-library), original `eslint-plugin-import` (superseded by `import-x`).

## Commit sequence

Self-contained, approval-gated commits; foundation first. Each is green on its own.

### 1. Core rules + config cleanups

- Add `js.configs.recommended`; install `eslint-config-prettier` and add it last.
- Remove the `no-unused-vars` custom block.
- Bump `react-refresh/only-export-components` to `error`.
- Bump `react-hooks/exhaustive-deps` to `error` (the recommended preset ships it at `warn`, the lone bug-catcher below the severity posture). Zero violations and zero disable comments today, so the bump is free; intentional dep omissions going forward take an explicit `eslint-disable-next-line`.
- Add `^web/eslint\.config\.js` to the pre-commit `WEB_CHANGED` pattern — every later commit edits that file, and it currently triggers no web checks.
- Fix whatever `js.configs.recommended` + the react-refresh bump surface.

### 2. Type-checked preset (atomic)

- Switch `tseslint.configs.recommended` → `recommendedTypeChecked`; add `projectService: true` + `tsconfigRootDir`; add `switch-exhaustiveness-check`.
- Introduce the test-files config block with `@typescript-eslint/unbound-method: 'off'` — `expect(obj.method)` is the suite's idiomatic assertion style and a known false positive for this rule. Commits 5–6 later add their plugins to the same block.
- The whole type-checked rule set turns on at once (a preset can't be adopted incrementally), so this commit fixes every violation the type-checked rules surface.

### 3. `@tanstack/eslint-plugin-query`

- Install; enable its recommended (`exhaustive-deps` for the hand-rolled `queryOptions` factories). Fix any violations it surfaces.

### 4. `@tanstack/eslint-plugin-router`

- Install; enable `create-route-property-order` (+ recommended). Fix any violations it surfaces.

### 5. `eslint-plugin-testing-library`

- Install; enable its flat recommended, **scoped to test files**. Fix any violations it surfaces.

### 6. `@vitest/eslint-plugin`

- Install; enable `no-focused-tests`, `no-disabled-tests`, `no-identical-title`, `valid-expect`, **scoped to test files**. Fix any violations it surfaces.

### 7. `eslint-plugin-import-x`

- Install `eslint-plugin-import-x` + `eslint-import-resolver-typescript`; enable **only** `import-x/no-cycle` with the TS resolver in `settings['import-x/resolver-next']`. Fix any violations it surfaces.

### 8. e2e ESLint config + CI/pre-commit wiring

- **`e2e/eslint.config.js`** mirroring web's language-level bar: `js.configs.recommended` + `recommendedTypeChecked` (`projectService: true` + `tsconfigRootDir` → `e2e/tsconfig.json`, which already includes all 17 files) + `switch-exhaustiveness-check` + `import-x/no-cycle` + `eslint-config-prettier` last, **plus `eslint-plugin-playwright`** recommended (`no-wait-for-timeout` enforces "never sleep"; `no-focused-test` catches committed `.only`). `ignores`: `playwright-report/`, `test-results/`, `supabase/`. No React-ecosystem plugins and no TS resolver — e2e has no path aliases.
- **Install (e2e devDeps):** `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-playwright`, `eslint-plugin-import-x`, `eslint-config-prettier`.
- **Scripts:** add `"lint": "eslint ."` to `e2e/package.json`; add `"e2e:lint": "cd e2e && npm run lint"` to root `package.json`.
- **CI (`.github/workflows/ci.yml`, e2e job):** move the e2e `npm ci` step **above** `supabase start`, then add a "Lint e2e" step right after it — a lint failure short-circuits before the 15-min stack spins up.
- **Pre-commit (`.husky/pre-commit`):** add an `E2E_CHANGED` branch (`git diff --cached --name-only | grep -E '^e2e/'`) that runs `e2e:format:check` + `e2e:lint` only — **never** the e2e tests (they need the Supabase stack; linting is seconds).
- Fix any violations the type-checked + Playwright rules surface (the async fixtures — `pg`/`fetch`/Supabase in `fixtures/` — are where `no-floating-promises` earns its keep).

## Out of scope

- Enforcing absolute-imports (`no-restricted-imports` / `import-x/no-relative-parent-imports`) — needs an ~80-site cleanup first; separate issue.
- Adopting `jsx-a11y` — blocked on upstream ESLint 10 support; revisit when it ships.
- Any formatting/stylistic rules — Prettier owns them.
