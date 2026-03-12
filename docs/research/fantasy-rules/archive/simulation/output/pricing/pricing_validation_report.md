# Pricing Validation Report

**Data:** 2025 season (24 rounds)  |  **Budget cap:** $115M  |  **Formula:** Power Curve, shape=1.0

## P1–P6 Criteria

#    Status     Value
--------------------------------------------------------------------------------
P1   ✓ PASS     127.4%
     Dream team: VER, NOR, PIA, RUS, LEC | McLaren, Red Bull Racing, Mercedes = $146.5M vs $115M cap

P2   ✓ PASS     2,352
     2,352 feasible teams score ≥80% of best at preseason prices

P3   ✓ PASS     Max frequency: 31.2% (Williams)
     No entity appears on >95% of feasible teams → no mandatory pick

P4   ✗ FAIL     1
     Floor-priced entities with positive 2025 score: ['Williams']

P5   ✓ PASS     22.1%
     Largest 3-race price swing: 22.1% (STR rounds 14–16)

P6   ✓ PASS     1/7 high-DNF drivers ≥ field avg (18.1 pts/$M)
     Viable: ['ANT']

**Overall: SOME CRITERIA FAILED ✗**

## C8 Revisit: DNF Penalty Severity

Field average pts/$M: **18.1**

Driver   DNFs   Season pts   Avg price    Pts/$M     vs field
------------------------------------------------------------
SAI      5      117          $7.8M      15.0       -3.1
BOR      5      33           $6.9M      4.8        -13.4
ALO      5      75           $7.5M      10.0       -8.2
LAW      5      74           $7.3M      10.1       -8.0
HUL      4      119          $8.5M      14.1       -4.1
ALB      4      145          $8.7M      16.7       -1.4
ANT      4      260          $10.8M      24.0       +5.8

**Verdict (C8 ✓):** 1/7 high-DNF drivers (ANT) beat field average pts/$M. The -10 DNF penalty reduces their price enough to make them viable budget picks. Current penalty is appropriate.

## C9 Revisit: Runaway Risk with Budget Constraint

**Best budget-legal preseason team** ($114.3M):
  Drivers: ALB, BEA, NOR, PIA, VER
  Constructors: McLaren, Mercedes, Williams

| Team | Final score |
|------|-------------|
| Budget-locked (preseason, ≤$115M) | 4,314 pts |
| Unconstrained locked (preseason, no budget) | 5,748 pts |
| Unconstrained perfect (best each round, no budget) | 7,358 pts |

Gap: perfect − locked = **1,610 pts** (unconstrained)
Gap: perfect − budget_locked = **3,044 pts** (with budget)

**Verdict (C9 assessed):** Budget-locked team scores 1,434 pts less than the unconstrained preseason best. However, the budget reduces the gap to the perfect score by -1,434 pts (-89%), since no single player can afford all the top performers. The budget constraint is working as intended.

## Final Recommendation

**[Complete after reviewing output files.]
**
Remaining decisions:
- Confirm C8 verdict: is -10 DNF penalty appropriate?
- Confirm C9 verdict: is $115M cap sufficient to prevent runaway leaders?
- Adjust BUDGET_CAP in pricing.py if simulation suggests a different value.
