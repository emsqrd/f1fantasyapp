# Three-Layer Constructor Scoring Model

An alternative constructor scoring model explored during design. Not adopted — simulation showed it created cliff effects around the gate threshold and didn't reliably achieve its stated goals.

**Why it was explored:** The intent was to reward mid-field team balance and penalise one-car dominant teams (e.g., Verstappen carrying Red Bull).

**Why it was not adopted:** The Layer 2 gate is tied to car pace, not team decisions — backmarker teams can never unlock Layer 2 regardless of how reliably both cars finish. Simulation showed Williams (2024) and Alpine (2025) scoring near zero or negative under this model despite completing full seasons, while the gate threshold had to be calibrated carefully to avoid unintended benefits for teams like Red Bull. The simple driver-sum model handles the one-car dynamic implicitly through the driver points table.

---

**Layer 1 — Base scoring:** Each constructor scores from both drivers' finishing positions using a flatter points table than drivers (P1-to-P10 ratio 6:1 vs 12.5:1). P11–P15 = 1 pt, P16+ = 0.

| Position | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | P11–15 | P16+ |
|----------|----|----|----|----|----|----|----|----|----|-----|--------|------|
| Points   | 12 | 10 |  9 |  8 |  7 |  6 |  5 |  4 |  3 |   2 |      1 |    0 |

**Layer 2 — Both-cars bonus:** +10 pts when both drivers finish in the top 10 (main race) or top 8 (sprint). Binary — either both in the points or not.

**Layer 3 — Spread bonus:** Tiered by gap between the two drivers' finishing positions. Gated behind Layer 2 (only applies when both cars are in the points). Rewards teams where both drivers perform — penalises one-car dominance.

| Gap | Bonus |
|-----|-------|
| 0–1 positions | +8 |
| 2–3 positions | +5 |
| 4–5 positions | +3 |
| 6+ positions | 0 |
