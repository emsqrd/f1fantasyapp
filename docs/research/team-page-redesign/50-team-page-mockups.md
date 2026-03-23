# Team Page Redesign — Mockups

## Before You Begin

Read `docs/research/50-team-page-findings.md` before proceeding. Do not proceed if that file does not exist — it is the output of the research phase and contains the layout recommendations, data placement decisions, and visual direction brief that drive this work.

Also read the following source files to understand app conventions and data shapes:

- `web/src/index.css` — design tokens (colors, radius, spacing)
- `web/src/contracts/Team.ts` — team, driver, and constructor data shapes
- `web/src/contracts/Race.ts` — race data shape

## UI States

Mockups must address the following distinct states:

- **Incomplete roster, pre-lock** — some slots are empty; editing is enabled
- **Full roster, pre-lock** — all slots filled; countdown visible; editing enabled
- **Locked roster** — countdown replaced with "Lineup Locked"; all editing disabled

Each pre-lock state must show the **captain selection affordance** — how does a user know they need to pick a captain, and how do they make the selection? Show both the prompt/discovery mechanism and the selection control. The locked state shows the selected captain with a non-interactive static badge — it must not use button chrome or any affordance that implies it can be tapped.

## Design Direction

Follow the visual direction from `docs/research/50-team-page-findings.md`. The current page feels monochromatic and flat in both light and dark mode — the redesign should feel considered and sports-adjacent.

**Constraints:**

- Keep the layout readable and information-dense — personality should come from color, typography, contrast, and purposeful micro-interactions, not decoration
- Must work in both light and dark mode. Include a light/dark toggle in the mockup for review purposes; the toggle must apply to the entire page (background, text, and card frames), not just card components.
- Mockups should represent the ideal state — show points on cards as if scoring is fully implemented. Do not use placeholder values like "-- pts"; show realistic figures.

**On imagery:** Driver/constructor avatars may be used as placeholders in mockups. Any design that depends on imagery should be annotated as requiring licensing investigation before implementation.

**On animation:** Small, purposeful micro-interactions are welcome if they communicate something meaningful (e.g. a state change, a confirmation). Where proposed, note the intended purpose and include a `prefers-reduced-motion` fallback. Animations should not be decorative or pervasive.

## Business Requirements

- Mobile-first design; layout is responsive (primary breakpoint: 640px)
- Mockups should illustrate both a **mobile view** and a **desktop view**
- Uses Tailwind CSS v4 and the shadcn/ui component library
- Follows existing app color tokens and radius conventions (see `web/src/index.css`)
- The UI is comprehensive, but simple — simplicity takes priority over elegance, but don't sacrifice creative solutions for the sake of simplicity

## Accessibility Requirements

WCAG 2.1 Level AA compliance is mandatory per `web/CLAUDE.md`. Accessibility must be designed in from the start — it is not a post-processing step.

**Contrast**

- Normal text: 4.5:1 minimum against its background. Large text (≥ 18pt or ≥ 14pt bold): 3:1 minimum.
- UI components and graphical objects: 3:1 against adjacent colors.
- **Verify all token values from `web/src/index.css` against their actual backgrounds — do not assume app tokens are accessible.** Known issue: `--muted-foreground: #71717b` fails on light card backgrounds (~3.2:1). Use `#6b6b6b` or darker for muted text in light mode.
- Constructor brand colors require adaptive text: white text works on Red Bull (`#3671C6`) and Ferrari (`#E8002D`); dark text (`#111`) is required on McLaren (`#FF8000`) and Mercedes (`#27F4D2`).
- Verify both light and dark mode — a color that passes in one may fail in the other.

**Touch targets**

- WCAG 2.1 AA has no minimum touch target size, but 24×24px with adequate spacing between targets is the accepted design standard.
- Use **24×24px as the design minimum** for interactive controls — appropriate for compact card UIs.
- **Design card layouts to accommodate this from the start.** If a card contains multiple stacked controls (e.g., remove button + captain toggle), the card height must comfortably contain both at 24px minimum. Do not design compact cards and then try to fit properly-sized buttons into them afterward.
- If 24×24px targets conflict with a compact layout goal, resolve the conflict with a considered interaction model — e.g., swipe-to-reveal for secondary actions, a single primary action per row, or taller cards — rather than shrinking targets.

**Color as the sole differentiator**

- Constructor brand colors may accent a card (stripe, chip background) but must not be the only means of identifying the constructor. A non-color identifier — text, label, or similar — must accompany any color-only element.

## Deliverables

- Add mockups to the `docs/mockups/` folder
- **3-5 distinct HTML mockup options** that follow app conventions and styling
- Mockups are non-functional. The only permitted interactivity is a light/dark mode toggle for review purposes.
- Each mockup covers: mobile layout, desktop layout, and the three UI states (incomplete, full pre-lock, locked)
- Mockups represent the ideal state — all data shown is intentional regardless of current API availability
- For each option, note whether the card layout has room for future additions (e.g. season points, round average) without a redesign
- The driver and constructor pickers (bottom sheets) are out of scope — mockups show the team view only
