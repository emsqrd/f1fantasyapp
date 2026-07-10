# Issue writing

How to write issue titles and bodies for this repo.

## Title

Lead with a verb, or state the symptom. ~6–10 words. No conventional-commit prefix. Make it specific enough to recognise in a backlog; put detail in the body. Name one concern.

| Off-the-cuff          | Template-shaped                                    |
| --------------------- | -------------------------------------------------- |
| `fix: lock bug`       | `Lineup picker stays editable after lock deadline` |
| `Countdown`           | `Add live countdown to lineup lock deadline`       |
| `Issue with leagues`  | `Private league invite link returns 404`           |
| `feat: scoring stuff` | `Add captain multiplier to scoring engine`         |

## Body

Each part below is its own `##` section header. Include a section only when it has real content.

- **`## Problem`** — state the gap as a problem, not a solution: _When &lt;situation&gt;, &lt;what happens&gt; — which is a problem because &lt;impact&gt;._
- **`## Outcome`** — give the resolved state in one line.
- **`## Acceptance criteria`** — list the checkable conditions that prove the outcome; map each to a test or an observation. State outcomes, not implementation — API calls, file paths, and component choices go in an issue comment.
- **`## Scope`** — state what's in and what's explicitly out.
- **`## Pointers`** — link relevant files, docs (`docs/research/…`, `docs/adr/…`), related issues.
- **`## Reproduction`** (bugs only) — give numbered steps, then **Expected**, **Actual**, **Environment**.

## Style

- Imperative, present tense, plain. No business jargon.
- Be concise. One concern per issue.
- Describe the state, not the diff or the history.
- Link, don't repeat.
