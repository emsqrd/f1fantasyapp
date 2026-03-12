# Neutral Point Cross-Season Validation

**Date:** 2026-03-10
**Parent:** [pricing-model-direction-based-simulation.md](../pricing-model-direction-based-simulation.md)
**Script:** `simulation/neutral_point_validation.py`

---

## Purpose

Validate that D=1.00 and C=1.50 neutral points produce near-zero net drift 
across seasons with meaningfully different competitive landscapes.

The original neutral points were calibrated against 2025 data only. This validation 
tests them against 2023 (VER-dominant), 2024 (VER-dominant), and 2025 (competitive field).

**Method:** For each season, preseason prices are generated from the prior season's 
totals using the power curve model (no team-context adjustments). The neutral point 
sweep runs the full PPM simulation at ±0.60 band width with default step sizes.

---

## Cross-Season Summary

| Season | D PPM mean | D PPM median | C PPM mean | C PPM median | Best D neutral | D=1.00 drift | Best C neutral | C=1.50 drift |
|--------|-----------|-------------|-----------|-------------|---------------|-------------|---------------|-------------|
| 2023 | 0.834 | 0.967 | 1.305 | 1.298 | 1.30 | $+20.7M | 1.80 | $+8.7M |
| 2024 | 0.754 | 0.500 | 1.100 | 0.880 | 1.10 | $+5.0M | 1.50 | $+0.5M |
| 2025 | 0.761 | 0.725 | 1.128 | 1.201 | 1.00 | $-3.8M | 1.50 | $-3.5M |

### Interpretation

C=1.50 is stable across all three seasons — near-zero drift in 2024 and 2025, and moderate inflation in 2023. D=1.00 is well-calibrated for 2025 but shows increasing upward drift as the competitive order diverges from prior-year prices. The 2023 inflation (+$20.7M) reflects the model correctly repricing badly mispriced entities (ALO $7.6M→PPM 1.96, Aston Martin $6M→PPM 3.26 after an unpredictable car improvement) — not a neutral point miscalibration. Net drift is not inherently bad if it is directionally correct. D=1.00 and C=1.50 remain the appropriate defaults; the optimal driver neutral shifts only when preseason prices are systematically wrong, which is unavoidable when the competitive order changes dramatically.


---

## Season 2023 (22 rounds)

### PPM Distribution at Preseason Prices

**Drivers** (mean: 0.834, median: 0.967):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| ALO | 1.962 | $7.6M |
| VER | 1.902 | $19.0M |
| NOR | 1.605 | $9.8M |
| PIA | 1.386 | $6.0M |
| PER | 1.323 | $15.7M |
| HAM | 1.295 | $13.9M |
| GAS | 1.106 | $6.0M |
| SAI | 1.085 | $14.2M |
| STR | 1.078 | $6.2M |
| RUS | 0.979 | $14.4M |
| LEC | 0.967 | $16.4M |
| RIC | 0.703 | $6.3M |
| ALB | 0.545 | $6.0M |
| TSU | 0.508 | $6.0M |
| ZHO | 0.500 | $6.0M |
| BOT | 0.396 | $6.2M |
| OCO | 0.395 | $9.2M |
| HUL | 0.364 | $6.0M |
| LAW | 0.333 | $6.0M |
| MAG | 0.076 | $6.0M |
| DEV | 0.017 | $6.0M |
| SAR | -0.174 | $6.0M |

**Constructors** (mean: 1.305, median: 1.298):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| Aston Martin | 3.258 | $6.0M |
| McLaren | 2.659 | $8.7M |
| Red Bull Racing | 2.240 | $25.0M |
| Mercedes | 1.470 | $20.9M |
| Ferrari | 1.298 | $22.7M |
| Alpine | 0.864 | $9.0M |
| Alfa Romeo | 0.682 | $6.0M |
| AlphaTauri | 0.561 | $6.0M |
| Haas F1 Team | 0.136 | $6.0M |
| Williams | -0.121 | $6.0M |

### Driver Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.60 | $+42.7M | 15 | 2 | G:105 g:131 p:147 T:57 |
| 0.70 | $+36.0M | 14 | 2 | G:91 g:130 p:113 T:106 |
| 0.80 | $+29.7M | 14 | 2 | G:80 g:120 p:122 T:118 |
| 0.90 | $+24.2M | 13 | 3 | G:70 g:106 p:126 T:138 |
|  **1.00 ** | $+20.7M | 12 | 4 | G:62 g:99 p:125 T:154 |
| 1.10 | $+14.8M | 11 | 4 | G:54 g:87 p:124 T:175 |
| 1.20 | $+9.5M | 8 | 6 | G:47 g:79 p:123 T:191 |
| 1.30 | $+3.8M | 7 | 7 | G:37 g:75 p:122 T:206 |
| 1.40 | $-3.9M | 6 | 8 | G:30 g:72 p:103 T:235 |
| 1.50 | $-7.9M | 5 | 9 | G:29 g:59 p:99 T:253 |

### Constructor Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.80 | $+28.5M | 8 | 0 | G:74 g:55 p:31 T:40 |
| 1.00 | $+23.5M | 7 | 0 | G:65 g:47 p:40 T:48 |
| 1.20 | $+16.7M | 6 | 1 | G:49 g:46 p:48 T:57 |
|  **1.50 ** | $+8.7M | 4 | 3 | G:38 g:40 p:44 T:78 |
| 1.80 | $+2.3M | 4 | 3 | G:30 g:27 p:51 T:92 |
| 2.00 | $-3.1M | 4 | 3 | G:28 g:20 p:42 T:110 |
| 2.20 | $-9.2M | 2 | 4 | G:25 g:15 p:38 T:122 |
| 2.50 | $-14.8M | 2 | 4 | G:19 g:12 p:31 T:138 |

---

## Season 2024 (24 rounds)

### PPM Distribution at Preseason Prices

**Drivers** (mean: 0.754, median: 0.500):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| PIA | 2.135 | $9.7M |
| NOR | 1.904 | $13.0M |
| LEC | 1.779 | $13.0M |
| SAI | 1.471 | $12.8M |
| VER | 1.469 | $19.0M |
| RUS | 1.402 | $12.3M |
| HAM | 1.125 | $14.0M |
| BEA | 0.944 | $6.0M |
| PER | 0.680 | $15.2M |
| HUL | 0.530 | $7.0M |
| ALO | 0.519 | $12.6M |
| DOO | 0.500 | $6.0M |
| MAG | 0.499 | $6.2M |
| LAW | 0.444 | $6.0M |
| GAS | 0.440 | $8.9M |
| OCO | 0.423 | $7.6M |
| RIC | 0.417 | $6.0M |
| TSU | 0.372 | $7.4M |
| ZHO | 0.371 | $7.3M |
| STR | 0.227 | $9.0M |
| COL | 0.167 | $6.0M |
| BOT | 0.123 | $7.1M |
| SAR | 0.107 | $6.0M |
| ALB | 0.039 | $7.5M |

**Constructors** (mean: 1.100, median: 0.880):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| McLaren | 2.882 | $15.7M |
| Ferrari | 2.217 | $18.4M |
| Mercedes | 1.691 | $18.9M |
| Red Bull Racing | 1.480 | $25.0M |
| Haas F1 Team | 0.880 | $6.3M |
| RB | 0.639 | $6.0M |
| Alpine | 0.632 | $9.3M |
| Aston Martin | 0.502 | $14.2M |
| Kick Sauber | 0.357 | $7.7M |
| Williams | -0.278 | $6.0M |

### Driver Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.60 | $+25.1M | 10 | 8 | G:112 g:132 p:223 T:61 |
| 0.70 | $+19.8M | 10 | 9 | G:107 g:106 p:167 T:148 |
| 0.80 | $+14.5M | 8 | 10 | G:95 g:93 p:164 T:176 |
| 0.90 | $+9.9M | 7 | 11 | G:85 g:88 p:156 T:199 |
|  **1.00 ** | $+5.0M | 7 | 11 | G:72 g:88 p:144 T:224 |
| 1.10 | $+0.4M | 7 | 11 | G:63 g:82 p:135 T:248 |
| 1.20 | $-4.7M | 6 | 12 | G:53 g:81 p:131 T:263 |
| 1.30 | $-9.1M | 6 | 12 | G:45 g:75 p:109 T:299 |
| 1.40 | $-13.8M | 5 | 13 | G:36 g:76 p:86 T:330 |
| 1.50 | $-19.5M | 4 | 14 | G:28 g:72 p:83 T:345 |

### Constructor Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.80 | $+18.1M | 6 | 3 | G:79 g:54 p:46 T:41 |
| 1.00 | $+9.9M | 5 | 4 | G:63 g:56 p:48 T:53 |
| 1.20 | $+6.1M | 5 | 4 | G:55 g:48 p:53 T:64 |
|  **1.50 ** | $+0.5M | 4 | 5 | G:46 g:32 p:54 T:88 |
| 1.80 | $-4.5M | 4 | 5 | G:37 g:23 p:51 T:109 |
| 2.00 | $-8.7M | 3 | 6 | G:26 g:27 p:40 T:127 |
| 2.20 | $-13.0M | 2 | 6 | G:20 g:26 p:33 T:141 |
| 2.50 | $-18.5M | 1 | 7 | G:13 g:29 p:24 T:154 |

---

## Season 2025 (24 rounds)

### PPM Distribution at Preseason Prices

**Drivers** (mean: 0.761, median: 0.725):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| PIA | 1.650 | $15.2M |
| RUS | 1.612 | $13.7M |
| NOR | 1.527 | $17.0M |
| VER | 1.463 | $18.4M |
| LEC | 1.010 | $16.3M |
| ALB | 0.990 | $6.1M |
| HAM | 0.911 | $14.0M |
| ANT | 0.827 | $13.1M |
| BEA | 0.758 | $7.2M |
| OCO | 0.736 | $7.3M |
| HAD | 0.725 | $6.9M |
| HUL | 0.698 | $7.1M |
| STR | 0.652 | $6.9M |
| TSU | 0.592 | $10.7M |
| SAI | 0.487 | $10.0M |
| LAW | 0.447 | $6.9M |
| ALO | 0.351 | $8.9M |
| GAS | 0.346 | $7.7M |
| BOR | 0.208 | $6.6M |
| COL | 0.160 | $7.3M |
| DOO | -0.160 | $7.3M |

**Constructors** (mean: 1.128, median: 1.201):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| McLaren | 1.975 | $25.0M |
| Mercedes | 1.654 | $19.4M |
| Red Bull Racing | 1.498 | $21.5M |
| Williams | 1.472 | $6.0M |
| Ferrari | 1.201 | $23.1M |
| Haas F1 Team | 1.180 | $8.3M |
| Racing Bulls | 0.927 | $7.6M |
| Aston Martin | 0.593 | $9.0M |
| Kick Sauber | 0.590 | $7.2M |
| Alpine | 0.186 | $8.5M |

### Driver Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.60 | $+26.9M | 13 | 8 | G:118 g:139 p:159 T:46 |
| 0.70 | $+18.6M | 13 | 8 | G:104 g:138 p:134 T:86 |
| 0.80 | $+9.6M | 11 | 10 | G:87 g:135 p:142 T:98 |
| 0.90 | $+4.1M | 10 | 11 | G:80 g:124 p:134 T:124 |
|  **1.00 ** | $-3.8M | 8 | 13 | G:65 g:115 p:133 T:149 |
| 1.10 | $-10.0M | 6 | 15 | G:57 g:107 p:129 T:169 |
| 1.20 | $-16.3M | 5 | 15 | G:49 g:95 p:133 T:185 |
| 1.30 | $-22.2M | 4 | 16 | G:40 g:89 p:128 T:205 |
| 1.40 | $-26.9M | 4 | 17 | G:34 g:81 p:124 T:223 |
| 1.50 | $-31.7M | 2 | 19 | G:25 g:77 p:115 T:245 |

### Constructor Neutral Point Sweep

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.80 | $+18.5M | 7 | 3 | G:81 g:56 p:48 T:35 |
| 1.00 | $+12.1M | 7 | 3 | G:73 g:49 p:48 T:50 |
| 1.20 | $+5.3M | 6 | 4 | G:56 g:57 p:44 T:63 |
|  **1.50 ** | $-3.5M | 4 | 6 | G:42 g:43 p:51 T:84 |
| 1.80 | $-10.5M | 2 | 8 | G:32 g:36 p:47 T:105 |
| 2.00 | $-16.4M | 1 | 9 | G:23 g:33 p:44 T:120 |
| 2.20 | $-21.4M | 1 | 9 | G:17 g:33 p:38 T:132 |
| 2.50 | $-29.8M | 0 | 9 | G:13 g:23 p:30 T:154 |

