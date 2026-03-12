# Pricing Bake-Off: Comparison Summary

**Data:** 2024 season totals (preseason pricing) → 2025 dream team validation

**Dream team:** VER, NOR, PIA, RUS, LEC + McLaren, Mercedes, Ferrari
**Dream team 2025 score:** 4,981 pts

## Best Parameters per Approach

Approach       Params                                                            Cap    DT Cost  Tightness
----------------------------------------------------------------------------------------------------------
linear         driver_pool=$150M, constructor_pool=$130M                       $130M    $169.1M    130.1%
power_curve    driver_ceiling=$19M, constructor_ceiling=$25M, shape=1.0        $115M    $149.5M    130.0%
rank_based     driver_ceiling=$18M, constructor_ceiling=$30M                   $125M    $161.8M    129.4%
tier_based     config=equal_quarts                                             $130M      $170M    130.8%

## Price Distribution Statistics

Metric                       Linear  Power Curve   Rank-Based   Tier-Based
------------------------------------------------------------------------
Drivers:
    Max price                $19.6M         $19M         $18M         $20M
    Mean price                $6.7M        $6.8M        $8.7M        $8.7M
    Std dev                   $6.0M        $5.7M        $5.5M        $7.0M
    Gini coeff                0.450        0.424        0.353        0.429
    Top/floor ratio           9.800        9.500        9.000       10.000
    At floor ($2M)            7.000        5.000        5.000        9.000
Constructors:
    Max price                $31.6M         $25M         $30M         $26M
    Mean price               $13.6M       $12.1M       $16.5M       $15.3M
    Std dev                  $12.6M        $9.1M        $9.1M        $8.6M
    Gini coeff                0.460        0.385        0.300        0.288
    Top/floor ratio          10.533        8.333       10.000        8.667
    At floor ($3M)            3.000        1.000        1.000        0.000

## Driver Price Lists (sorted by 2024 per-race avg)

  Driver    2024 avg     Linear   PowerCurve  RankBased  TierBased
  --------------------------------------------------------------
  VER           29.3     $19.6M         $19M       $18M       $20M
  NOR           25.5     $17.1M       $16.6M     $17.2M       $20M
  LEC           25.2     $16.9M       $16.5M     $16.3M       $20M
  PIA           22.3       $15M       $14.7M     $15.5M       $20M
  SAI           19.9     $13.3M       $13.2M     $14.6M       $20M
  RUS           18.8     $12.6M       $12.5M     $13.8M       $12M
  HAM           18.6     $12.5M       $12.4M     $12.9M       $12M
  PER           12.2      $8.2M        $8.5M     $12.1M       $12M
  ALO            7.2      $4.8M        $5.3M     $11.3M       $12M
  GAS            6.0        $4M        $4.6M     $10.4M       $12M
  ZHO            5.5      $3.7M        $4.3M      $9.6M        $6M
  MAG            5.4      $3.6M        $4.2M      $8.7M        $6M
  OCO            5.1      $3.4M        $4.1M      $7.9M        $6M
  HUL            5.0      $3.4M          $4M      $7.1M        $6M
  RIC            4.1      $2.8M        $3.4M      $6.2M        $6M
  TSU            3.8      $2.6M        $3.3M      $5.4M        $2M
  STR            3.4      $2.3M          $3M      $4.5M        $2M
  SAR            2.5        $2M        $2.4M      $3.7M        $2M
  BOT            2.1        $2M        $2.2M      $2.8M        $2M
  ALB            1.8        $2M          $2M        $2M        $2M
  COL         rookie        $2M          $2M        $2M        $2M
  LAW         rookie        $2M          $2M        $2M        $2M
  BEA         rookie        $2M          $2M        $2M        $2M
  DOO         rookie        $2M          $2M        $2M        $2M

## Constructor Price Lists (sorted by 2024 per-race avg)

  Constructor       2024 avg     Linear   PowerCurve  RankBased  TierBased
  ----------------------------------------------------------------------
  McLaren               35.3     $31.6M         $25M       $30M       $26M
  Ferrari               34.7       $31M       $24.6M       $27M       $26M
  Mercedes              28.2     $25.3M       $20.6M       $24M       $26M
  Red Bull Racing       26.6     $23.8M       $19.6M       $21M       $15M
  Aston Martin           6.0      $5.4M        $6.8M       $18M       $15M
  Haas F1 Team           5.7      $5.1M        $6.6M       $15M       $15M
  Alpine                 4.9      $4.4M        $6.1M       $12M       $15M
  RB                     3.3        $3M        $5.1M        $9M        $5M
  Kick Sauber            0.5        $3M        $3.4M        $6M        $5M
  Williams              -0.1        $3M          $3M        $3M        $5M

## Dream Team Cost Breakdown

  Entity       Type         Linear   PowerCurve  RankBased  TierBased
  -----------------------------------------------------------------
  VER          driver       $19.6M         $19M       $18M       $20M
  NOR          driver       $17.1M       $16.6M     $17.2M       $20M
  PIA          driver         $15M       $14.7M     $15.5M       $20M
  RUS          driver       $12.6M       $12.5M     $13.8M       $12M
  LEC          driver       $16.9M       $16.5M     $16.3M       $20M
  McLaren      constr       $31.6M         $25M       $30M       $26M
  Mercedes     constr       $25.3M       $20.6M       $24M       $26M
  Ferrari      constr         $31M       $24.6M       $27M       $26M
  -----------------------------------------------------------------
  TOTAL                    $169.1M      $149.5M    $161.8M      $170M
  vs cap                     $130M        $115M      $125M      $130M
  Tightness                 130.1%       130.0%     129.4%     130.8%

## Team Diversity Analysis

  Metric                             Linear   PowerCurve  RankBased  TierBased
  ---------------------------------------------------------------------------
  Feasible teams                  5,070,784    5,068,976  4,951,464  5,023,542
  Best team score                 4,382 pts    4,382 pts  4,362 pts  4,316 pts
  Teams ≥80% of best                 26,617       25,086     14,218     30,802

## Driver Price Distribution (bar chart)

### linear

  VER          ████████████████████████████████████████ $19.6M
  NOR          ███████████████████████████████████      $17.1M
  LEC          ██████████████████████████████████       $16.9M
  PIA          ███████████████████████████████          $15M
  SAI          ███████████████████████████              $13.3M
  RUS          ██████████████████████████               $12.6M
  HAM          ██████████████████████████               $12.5M
  PER          █████████████████                        $8.2M
  ALO          ██████████                               $4.8M
  GAS          ████████                                 $4M
  ZHO          ████████                                 $3.7M
  MAG          ███████                                  $3.6M
  OCO          ███████                                  $3.4M
  HUL          ███████                                  $3.4M
  RIC          ██████                                   $2.8M
  TSU          █████                                    $2.6M
  STR          █████                                    $2.3M
  SAR          ████                                     $2M
  BOT          ████                                     $2M
  ALB          ████                                     $2M
  COL          ████                                     $2M
  LAW          ████                                     $2M
  BEA          ████                                     $2M
  DOO          ████                                     $2M

### power_curve

  VER          ████████████████████████████████████████ $19M
  NOR          ███████████████████████████████████      $16.6M
  LEC          ███████████████████████████████████      $16.5M
  PIA          ███████████████████████████████          $14.7M
  SAI          ████████████████████████████             $13.2M
  RUS          ██████████████████████████               $12.5M
  HAM          ██████████████████████████               $12.4M
  PER          ██████████████████                       $8.5M
  ALO          ███████████                              $5.3M
  GAS          ██████████                               $4.6M
  ZHO          █████████                                $4.3M
  MAG          █████████                                $4.2M
  OCO          █████████                                $4.1M
  HUL          ████████                                 $4M
  RIC          ███████                                  $3.4M
  TSU          ███████                                  $3.3M
  STR          ██████                                   $3M
  SAR          █████                                    $2.4M
  BOT          █████                                    $2.2M
  ALB          ████                                     $2M
  COL          ████                                     $2M
  LAW          ████                                     $2M
  BEA          ████                                     $2M
  DOO          ████                                     $2M

### rank_based

  VER          ████████████████████████████████████████ $18M
  NOR          ██████████████████████████████████████   $17.2M
  LEC          ████████████████████████████████████     $16.3M
  PIA          ██████████████████████████████████       $15.5M
  SAI          ████████████████████████████████         $14.6M
  RUS          ███████████████████████████████          $13.8M
  HAM          █████████████████████████████            $12.9M
  PER          ███████████████████████████              $12.1M
  ALO          █████████████████████████                $11.3M
  GAS          ███████████████████████                  $10.4M
  ZHO          █████████████████████                    $9.6M
  MAG          ███████████████████                      $8.7M
  OCO          ██████████████████                       $7.9M
  HUL          ████████████████                         $7.1M
  RIC          ██████████████                           $6.2M
  TSU          ████████████                             $5.4M
  STR          ██████████                               $4.5M
  SAR          ████████                                 $3.7M
  BOT          ██████                                   $2.8M
  ALB          ████                                     $2M
  COL          ████                                     $2M
  LAW          ████                                     $2M
  BEA          ████                                     $2M
  DOO          ████                                     $2M

### tier_based

  VER          ████████████████████████████████████████ $20M
  NOR          ████████████████████████████████████████ $20M
  LEC          ████████████████████████████████████████ $20M
  PIA          ████████████████████████████████████████ $20M
  SAI          ████████████████████████████████████████ $20M
  RUS          ████████████████████████                 $12M
  HAM          ████████████████████████                 $12M
  PER          ████████████████████████                 $12M
  ALO          ████████████████████████                 $12M
  GAS          ████████████████████████                 $12M
  ZHO          ████████████                             $6M
  MAG          ████████████                             $6M
  OCO          ████████████                             $6M
  HUL          ████████████                             $6M
  RIC          ████████████                             $6M
  TSU          ████                                     $2M
  STR          ████                                     $2M
  SAR          ████                                     $2M
  BOT          ████                                     $2M
  ALB          ████                                     $2M
  COL          ████                                     $2M
  LAW          ████                                     $2M
  BEA          ████                                     $2M
  DOO          ████                                     $2M


## Constructor Price Distribution (bar chart)

### linear

  McLaren           ████████████████████████████████████████ $31.6M
  Ferrari           ███████████████████████████████████████  $31M
  Mercedes          ████████████████████████████████         $25.3M
  Red Bull Racing   ██████████████████████████████           $23.8M
  Aston Martin      ███████                                  $5.4M
  Haas F1 Team      ██████                                   $5.1M
  Alpine            ██████                                   $4.4M
  RB                ████                                     $3M
  Kick Sauber       ████                                     $3M
  Williams          ████                                     $3M

### power_curve

  McLaren           ████████████████████████████████████████ $25M
  Ferrari           ███████████████████████████████████████  $24.6M
  Mercedes          █████████████████████████████████        $20.6M
  Red Bull Racing   ███████████████████████████████          $19.6M
  Aston Martin      ███████████                              $6.8M
  Haas F1 Team      ███████████                              $6.6M
  Alpine            ██████████                               $6.1M
  RB                ████████                                 $5.1M
  Kick Sauber       █████                                    $3.4M
  Williams          █████                                    $3M

### rank_based

  McLaren           ████████████████████████████████████████ $30M
  Ferrari           ████████████████████████████████████     $27M
  Mercedes          ████████████████████████████████         $24M
  Red Bull Racing   ████████████████████████████             $21M
  Aston Martin      ████████████████████████                 $18M
  Haas F1 Team      ████████████████████                     $15M
  Alpine            ████████████████                         $12M
  RB                ████████████                             $9M
  Kick Sauber       ████████                                 $6M
  Williams          ████                                     $3M

### tier_based

  McLaren           ████████████████████████████████████████ $26M
  Ferrari           ████████████████████████████████████████ $26M
  Mercedes          ████████████████████████████████████████ $26M
  Red Bull Racing   ███████████████████████                  $15M
  Aston Martin      ███████████████████████                  $15M
  Haas F1 Team      ███████████████████████                  $15M
  Alpine            ███████████████████████                  $15M
  RB                ████████                                 $5M
  Kick Sauber       ████████                                 $5M
  Williams          ████████                                 $5M


## Recommendation

**Complete this section after reviewing the output above.**

Evaluation criteria:

- P1: Dream team costs 125–140% of budget
- P2: At least 50 feasible teams score within 80% of best
- Qualitative: Does the price list feel fair and intuitive?
- Qualitative: Does score magnitude translate meaningfully to price?
- Qualitative: Are there interesting trade-offs between picks?

Winner: **[TBD — fill in after reviewing comparison_summary.md]**

