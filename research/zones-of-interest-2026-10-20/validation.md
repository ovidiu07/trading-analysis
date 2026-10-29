# Validation record — 20 October 2026

Workspace: `/Users/ovidiu/Documents/trading-analysis`, branch `redesign-upgraded-improved`. The user-supplied working copy of `zones-of-interest.pine` was analysed and preserved before replacement. Existing unrelated working-tree changes were not included in this work. Exact delivered and QA source hashes are in [source-sha256.json](source-sha256.json).

## User-requested default preset update — 20 October 2026

After the runtime checks below, the user requested that source defaults match their current TradingView configuration. Read-only inspection confirmed nine differences: EQH/EQL, origins and FVG detection OFF; both liquidity colours `#FF9800`; reaction borders Dotted; liquidity and FVG borders Solid; label size Tiny. Other input values already matched. Only these nine input literals changed in the main indicator; the detector and rendering implementations are unchanged. The standalone QA source was regenerated to keep it aligned with the main source, and current hashes are recorded in `source-sha256.json`. The hashes of the versions used for the earlier TradingView runs are preserved in `source-sha256-before-default-update.json`.

Validation for this small preset edit: exact nine-input-literal comparison against the previously validated source hash, regenerated-harness provenance, current source hashes and `git diff --check`. No new TradingView compilation or full runtime suite was performed for the default-literal edit. The existing TradingView instance's custom settings were inspected without changing their values.

## TradingView compiler and chart runtime

Validation used the actual TradingView desktop Pine Editor and chart runtime, not a third-party Pine parser or Python approximation.

- Main source compiled and rendered on `VANTAGE:GER40FT`, standard 5-minute candles, in the existing historical replay chart. The original replay position/timeframe was retained. The final source was compiled again there at 20:15:23 Europe/Bucharest. It correctly reported unavailable volume while continuing the price model.
- A separate **ZOI validation** layout was created for current-data and timeframe checks. Its URL is `https://www.tradingview.com/chart/4TXIBYnZ/` (account layout, not a public script publication).
- The final main source compiled successfully on the clean 5-minute chart at 20:13:23 Europe/Bucharest. Final title is **Devtrader Zones of Interest**, short title **Devtrader ZOI**.
- The standalone QA source, built from the delivered main source, compiled at 20:12:01 and displayed **ZOI QA PASS: 28 assertions**. The same source executed successfully on 5-minute, 1-hour and 1-day charts.
- Observed automatic HTF mapping: `5 / 60`, `60 / 720`, `1D / 12D`. Daily charts retained weekly references and did not produce daily liquidity candidates.
- TradingView Settings exposed the detection, lifecycle, colour, line/border, geometry, label and marker inputs. Boundary-line geometry and Diamond event markers were previewed successfully; Cancel restored the default settings.
- Final UI restoration uses the delivered main source rather than either QA harness. The main indicator is loaded as an unsaved Pine draft; it was not publicly published.

Final QA screenshots:

- [5-minute QA](final-qa-28-5m.png)
- [Hourly QA](final-qa-28-1h.png)
- [Daily QA](final-qa-28-daily.png)
- [Appearance controls and preview](appearance-controls.png)
- [Main indicator final preview](final-main.png)

## What the 28 assertions exercise

The harness uses the actual `f_step()` and `f_select()` functions from the main source. It does not reproduce their implementation in another language.

22 lifecycle cases cover: creation-bar exclusion; first support rejection; ongoing contact counted once; no repeated rejection on departure; a new test after leaving/re-entering; invalidation precedence; terminal resolution; close and wick invalidation; delayed rejection on departure; sweep buffer boundary; high-side sweep; acceptance/taken classification; low-side symmetry; partial FVG survival; midpoint, full-fill and first-touch thresholds; broken-FVG precedence; bearish FVG symmetry; supply rejection; and exact TTL expiry.

Three timeframe checks cover 5-minute→60-minute conversion, 15-minute→180-minute conversion, and the 12M ceiling. Three display checks verify that high-priority liquidity cannot crowd out all eligible reaction zones, unused family budget is filled, and selection leaves source priority values unchanged.

These cases validate specific state transitions and selection semantics. They are not empirical reaction-rate or profitability tests. The harness's synthetic candle values are deliberately chosen to cover boundaries, rather than being imported market samples.

## Footprint companion

The exact companion compiled in TradingView at 20:09:50 and executed on the same symbol's current hourly feed. Its status showed native footprint data available, with **9,311 confirmed data bars** in that observed snapshot. The default filters had zero remaining untouched POC rows at that moment; the script displayed that zero honestly.

The earlier historical replay test returned unavailable footprint data and zero available-data bars without creating substitute zones: [unavailable-data screenshot](footprint-runtime.png). Current available-data evidence: [native hourly footprint status](footprint-live-1h.png).

A separate [footprint-data-qa.pine](footprint-data-qa.pine) changes only the title and three input defaults, then appends a coverage counter. It uses 1,000 ticks per row, 0.5× prior volume baseline, and a 1% POC-share threshold to exercise data-access and drawing branches. Those relaxed thresholds are **coverage settings**, not recommended or optimised trading parameters. It compiled at 20:10:59 and displayed **6,461 rows created / 9 still untouched** in the captured dataset snapshot. POC bands, their actual row volume shares, and first-retest markers rendered: [footprint drawing QA](footprint-data-qa.png). Public companion defaults remain 100 ticks, 1.5× baseline and 15% POC share.

This proves actual native-data access and POC creation/rendering on this feed/account. It does not prove Level 2 order visibility, bid/ask aggressor accuracy, exchange-wide volume completeness, attraction probability, or support across other account entitlements/data feeds.

## Reproducibility and local checks

Rebuild standalone QA sources from the current delivered files:

```sh
python3 research/zones-of-interest-2026-10-20/build_qa.py
```

Paste `zones-lifecycle-qa.pine` into a separate Pine indicator and Add to chart. Successful execution shows the green PASS panel. The footprint harness additionally requires a TradingView plan and symbol/history with footprint access. The build script fails if a title/default substitution no longer matches exactly, instead of silently testing an unrelated version.

Local verification confirmed the standalone main QA file is byte-for-byte the current main source (apart from its test title) plus `lifecycle-assertions.inc`. `git diff --check` passed. The main source has 60 editable inputs. It uses three security requests; the separate companion uses one footprint request. Chart draw handles are bounded below TradingView's declared limits.

## Remaining evidence boundaries

- No calibrated win probability, strategy trades, chronological out-of-sample study, attraction hit rate, or profitability measurement was performed. The original KNN vote did not establish these either.
- No claim that the displayed ranking maximises trading performance. Source weights, thresholds and freshness penalties are explicit modelling choices.
- Visual/runtime checks cover this symbol on 5-minute, hourly and daily standard candles. Other symbols, second/tick/non-standard charts, every appearance combination, maximum object settings, every manual HTF error path, and long-duration live/reload equivalence were not exhaustively exercised.
- Price data and pivot books depend on loaded history and provider revisions. Close confirmation avoids deliberate intrabar/HTF timing leakage; it cannot make revised source data immutable.
- “Draw from origin” intentionally backpaints if enabled. It remains OFF by default. Stored provenance distinguishes origin from actual detection.
- Alerts cover tracked zones, including candidates hidden by display score/distance/rank. No account alerts were created.
- Files are delivered locally. No application deployment, public TradingView publication, or Git commit/push formed part of this validation.
