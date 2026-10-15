# Exploratory FVG age comparison — 14 October 2026

Actual separate TradingView chart runs on PEPPERSTONE:GER40F, standard 5-minute candles, chart report 15 June–14 October 2026. Fixed test capital USD 1,000,000; source defaults remain USD 10,000. Other trading settings stayed at source defaults: 25% depth, 1:1.5 R:R, BE 70% trigger / 0% lock, zero commission/slippage, high historical detail. These results are not the user’s full historical dataset or out-of-sample proof.

R uses actual reported account P/L divided by the initial stop risk observed at the fill, using TradingView instrument point value and account conversion. BE/protected exits use their actual result. Drawdown is closed-trade R equity; duration is calendar hours through the last observed exit, with unrecovered periods marked.

| Mode | Age | Trades | Wins | Losses | Zero R / BE exits | Win rate | Total R | Expectancy R | PF money / R | Max DD R | Max loss streak | Longest observed DD hours |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | OFF | 92 | 27 | 51 | 14 / 14 | 29.35% | -10.5344 | -0.1145 | 0.7956 / 0.7936 | 15.0053 | 6 | 2786.00 |
| B | 2 | 65 | 26 | 28 | 11 / 11 | 40.00% | +11.7724 | +0.1811 | 1.4242 / 1.4204 | 4.5019 | 4 | 1438.25 |
| C | 3 | 81 | 31 | 38 | 12 / 12 | 38.27% | +9.2691 | +0.1144 | 1.2460 / 1.2439 | 5.0000 | 4 | 940.33 |
| D | 4 | 83 | 31 | 39 | 13 / 13 | 37.35% | +7.4917 | +0.0903 | 1.1937 / 1.1921 | 5.0000 | 4 | 815.58 |
| E | 6 | 86 | 30 | 42 | 14 / 14 | 34.88% | +2.9931 | +0.0348 | 1.0735 / 1.0713 | 6.5000 | 4 | 1799.50 |

All five runs finish below an earlier R equity peak; the longest-drawdown figures include observed unrecovered periods. Zero-R counts overlap BE exit counts in these runs because the fixed protection destination was 0%. Other settings can produce positive or negative BE exits.

| Mode | London trades | London total R | London expectancy R | New York trades | New York total R | New York expectancy R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 53 | -7.5325 | -0.1421 | 39 | -3.0019 | -0.0770 |
| B | 41 | +6.9981 | +0.1707 | 24 | +4.7743 | +0.1989 |
| C | 52 | +6.9966 | +0.1346 | 29 | +2.2725 | +0.0784 |
| D | 53 | +8.4950 | +0.1603 | 30 | -1.0033 | -0.0334 |
| E | 54 | +1.4950 | +0.0277 | 32 | +1.4981 | +0.0468 |

Annual attribution uses exit year in Europe/Bucharest. Every delivered trade belongs to partial-year 2026, so annual values equal the overall values above. The JSON preserves year buckets for future multi-year exports.

| Mode | Baseline trades retained | Baseline trades removed | Removed winners / losers / zero R | Removed total R | Added trades from other opportunities | Added total R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| B | 50 | 42 | 8 / 29 / 5 | -17.0326 | 15 | +5.2742 |
| C | 66 | 26 | 3 / 19 / 4 | -14.5294 | 15 | +5.2742 |
| D | 69 | 23 | 2 / 18 / 3 | -15.0277 | 14 | +2.9983 |
| E | 76 | 16 | 1 / 14 / 1 | -12.5292 | 10 | +0.9983 |

The age filter can release the single pending-order reservation sooner, allowing different later setups. Existing consecutive-loss rules also alter subsequent eligibility when earlier outcomes change. These are valid strategy-lifecycle effects, so the filtered runs are not necessarily simple subsets of baseline trades.

The two-bar run has the strongest historical expectancy and total R in this small inspected sample; every enabled mode improved those measures over this baseline. That observation does not establish the best strategy. Trade frequency, London/New York effects, drawdown duration, cost assumptions, partial-year coverage, and sampling uncertainty all matter. No additional parameters were tuned, and the default remains OFF. Preserve all five configurations and validate a predeclared unseen period before adopting a setting.

Native reports, raw Pine Logs, normalized trades, run manifest, original source snapshot, regression evidence, and higher-timeframe audit are preserved in this folder. See the implementation guide for reproducible export instructions.
