# Devtrader Zones of Interest

Reviewed and implemented 20 October 2026. Main source: `backend/src/main/resources/pine/published/zones-of-interest.pine`. Optional volume-at-price companion: `backend/src/main/resources/pine/published/zones-of-interest-footprint.pine`.

The indicator identifies reproducible **areas to investigate**, not guaranteed future reactions or observed resting orders. Its score is a transparent structural heuristic. It has not been calibrated as a probability or validated as a profitable strategy. An untouched liquidity pool or POC is a potential target hypothesis, not proof that price must reach it.

## Audit of the supplied script

The supplied 374-line Pine v6 script called itself “ML Liquidity Zone Classifier [PhenLabs]”. Its exact original is preserved in `research/zones-of-interest-2026-10-20/baseline-before-upgrade.pine` (SHA-256 `02ce5671e1d82159d6a86d826b850dad9e237b6ff3fca422ae34eb0ee6a6410b`). The staged file was empty and the working file contained this source; the working source was the baseline inspected, not a substitute from Git history.

| Finding in original | Consequence | Replacement |
| --- | --- | --- |
| KNN target was `abs(current close - historical close) > ATR threshold`, evaluated on every historical bar | Either-direction movement qualified as success. Neither zone direction, first retest, failure-before-reaction, nor liquidity attraction was learned. A neighbor vote was labelled “confidence %” without probability calibration. | Remove this model. Show evidence `/100`, with source strength, confluence, retest and age components. |
| Every same-bar candidate shared the current feature vector | A pivot from five bars ago, the previous candle's “OB”, and a current high-volume candle received the same classification | Each zone carries its actual family, source timeframe, origin, confirmation time, creation ATR and lifecycle. |
| HTF expression used `[1]` with `lookahead_off` | Historical and realtime delivery of the previous HTF candle were not aligned despite the comment claiming otherwise | Offset every HTF expression and request with `lookahead_on`, matching TradingView's documented confirmed-data pattern. |
| Automatic timeframe stopped at `M` | Monthly and larger charts could request a timeframe that was not higher | Use `timeframe.from_seconds()`, cap at 12M, require strictly higher manual HTF, and disable unavailable auto context at the ceiling. |
| “High volume node” meant a candle with unusually high aggregate volume | Aggregate candle volume does not identify the distribution of volume across its price range | Main script uses relative volume only as a small optional evidence bonus. Companion reads native footprint POC rows. |
| Equal highs/lows compared only the most recent pair | Missed non-adjacent clusters and lacked persistent consumed-pivot evidence | Search a bounded book of confirmed pivots, enforce separation, and retire breached or consumed evidence. |
| High-side liquidity and resistance shared bearish close-break mitigation | A liquidity pool can be consumed by a wick without a close beyond it | Give inferred liquidity its own taken/swept terminal states. |
| One new zone per cooldown, with fixed priority | Simultaneous evidence was discarded because of its place in the priority order | Evaluate independent families and deduplicate within the same family, source and side. |
| Any overlap blocked any new zone, irrespective of side/type | Support, resistance, and liquidity could suppress each other | Preserve separate economic roles and use proximity as confluence. |
| Large bands were shortened around their midpoint | Displayed prices no longer represented the detected candle's actual bounds | Reject oversized origins/FVGs; never invent replacement bounds to fit the chart. |
| Pivots/OBs were drawn back at their origins | Historical appearance implied the zone existed before confirmation | Start drawings at detection by default. An explicit backpainting option exposes origin-based drawing. |
| Fixed colours, box geometry, widths and label shapes | Limited customisation | Grouped colour, geometry, style, width, transparency, label and event-shape inputs. |

The original was already Pine v6 and already restricted its detector to closed chart bars. Those useful choices were retained. This is a deliberate detector replacement; it does not preserve the old KNN outputs. The original remains separately reviewable.

## Detection and interpretation

| Source label | Interpretation | Confirmation and bounds |
| --- | --- | --- |
| Swing | Possible support/demand or resistance/supply | `ta.pivothigh/low` with configurable left/right bars. Band grows inward from the pivot extreme by a fraction of **pivot-time ATR**. |
| EQH / EQL | Inferred buy-side / sell-side liquidity near repeated highs/lows | At least two confirmed pivots, separated by the minimum bars and inside ATR tolerance. Up to 80 pivots per side and a configurable chart-bar search horizon. The band covers matched extremes plus a small tolerance pad. |
| Origin | Displacement origin / order-block hypothesis | A strong body closes through a previously confirmed swing, closes near the candle extreme, and follows a recent opposite candle. Band is that candle's wick-to-open region. Reject invalidated or oversized origins. This does not prove institutional order placement. |
| FVG | Three-candle price imbalance / possible reaction area | Current low exceeds the high two bars ago, or current high is below the earlier low, with a strong directional middle candle. Minimum/maximum size use ATR from before that middle candle. Trading-break gaps are excluded by default. |
| HTF | Confirmed higher-timeframe support/resistance | Pivots confirmed on the requested HTF. Receive the closed confirmation bar after the HTF rolls; stored origin accounts for the right-side pivot delay. |
| PDH / PDL / PWH / PWL | Previous day/week extreme, treated as inferred liquidity | Only completed exchange/provider day/week candles. Day references only below daily; week references only below weekly. No lower-timeframe sampling on larger charts. |

The standard time-based chart is the working resolution: five confirmation bars mean 25 minutes after a 5-minute pivot, or five hours after a 1-hour pivot. Auto HTF uses chart duration × 12 by default, converted to a valid Pine timeframe. For example, a 5-minute chart uses 60 minutes and a 15-minute chart uses 180 minutes. This does not imply that a multiplier of 12 is optimal. At the maximum supported timeframe, chart detection continues and the dashboard says the higher context is unavailable. Synthetic and tick charts raise a clear error instead of using misleading price/time assumptions.

The day/week boundaries come from the chart symbol's TradingView feed/session, not the computer timezone or a hand-defined London/New York session. Tooltips display origin and detection times in the symbol's exchange timezone.

## Lifecycle

All detection and market-state mutation runs inside `barstate.isconfirmed`. A new zone becomes usable after its detection candle closes. That candle cannot also count as a retest.

- **Reaction zones:** active → tested → broken or expired. A new test requires an entry into the band after leaving it. Staying in the band for five candles counts as one test. A rejection can confirm during that contact or on the following departure candle; one marker per episode. Close-break is the default, with configurable wick-break and a creation-ATR buffer.
- **Liquidity:** active → swept or taken, then terminal. A sweep means price exceeds the buffered outer boundary and closes back beyond the opposite edge of the band. A breach without that rejection consumes the pool as “Taken”. The underlying equal-pivot evidence is retired too. This describes OHLC observations, not actual stop orders or executions.
- **FVG:** active → filled or broken/expired. Choose first touch, midpoint, or full fill. If the same candle invalidates the gap and meets the fill threshold, invalidation wins; the script does not infer a favorable intrabar path.
- **Resolved history:** deleted by default, or optionally retained with a frozen right endpoint and grey appearance. Retention is bounded; the script is a working map, not an immutable research database.

A maximum tracked count bounds memory. When full, resolved records are removed first; otherwise distant weak records are evicted. Display ranking then selects up to the visible count from active zones within the ATR distance and score limits. By default half the display budget is reserved for reaction zones and half for liquidity; unused space is filled by remaining candidates. This balance can be disabled. Period-origin dates appear on daily/weekly labels so retained older extremes are distinguishable from the latest period. Hiding a distant zone does not resolve it. Nearby independent families/timeframes on the same price side add confluence without changing their original price bounds.

Evidence = base strength + up to 16 nearby-confluence points − 5 per retest (capped at 25) − up to 15 age points. Base strengths are 45 for chart swings, 55 for FVGs, 60 for displacement origins, 65 for HTF swings and basic equal pools, 70 for prior day extremes, and 80 for prior week extremes. Additional equal pivots can add up to 15; available relative volume can add up to 10 to swings/origins. Values are clamped to 0–100. Missing/zero volume adds no volume bonus and does not suppress price-only detection. These are user-reviewable heuristics, not empirically fitted weights.

The panel lists the nearest tracked unconsumed liquidity band above and below the **last closed price**, including targets outside the display distance. “None tracked” is an honest absence in the bounded model. It does not mean the market contains no liquidity. Event counters count bars containing events, not the total number of individual zones.

Alerts cover all tracked qualifying structural events, including zones hidden by display ranking or distance/score settings. The minimum evidence score is a display filter, not an alert or detection filter. Select the individual event you want in TradingView's Create Alert dialog, with **Once Per Bar Close**. No alerts are created automatically.

## Visual controls

The default preset matches the user's TradingView settings captured on 20 October 2026: swing support/resistance ON; equal-high/low liquidity, displacement origins and FVG detection OFF; both liquidity colours orange (`#FF9800`); reaction borders Dotted; liquidity and FVG borders Solid; label size Tiny. Numeric settings, HTF/day/week controls, box-with-midpoint geometry, label visibility, Triangle event markers and dashboard settings retain their matching values. The optional detectors remain available through Inputs.

The main script exposes independent support/resistance, high-side/low-side liquidity and bullish/bearish FVG colours, resolved colour, label text, dashboard background, fresh/retested fill transparency, solid/dashed/dotted family styles, line/border width, and these geometries:

- Box with midpoint.
- Box only.
- Two boundary lines.
- Single midpoint level.

Labels show source, role, evidence and freshness. Tooltips show exact band and origin/detection times. Event markers can be triangles, circles, diamonds or arrows; their colours follow support/resistance inputs. Labels, markers and the dashboard can be toggled; label size, offset and dashboard position are editable. “Draw from origin” is OFF by default because it paints into bars preceding detection.

## Optional 2026 footprint companion

`zones-of-interest-footprint.pine` is a separate indicator because scripts using `request.footprint()` require **Premium or Ultimate**. Keeping that call out of the main indicator preserves ordinary-plan compatibility; an off toggle inside the same source is not a reliable entitlement fallback.

The companion makes exactly one footprint request per bar and reads `footprint.poc()`, `volume_row.up_price()`, `down_price()` and `total_volume()`. It creates a POC price band only when the **footprint's** total volume is above its prior rolling baseline and the POC row contains the selected share of that volume. Using the footprint volume baseline avoids silently treating daily OHLCV totals and intraday footprint totals as identical. Row resolution is configurable in **ticks**, so it must be chosen for the instrument's tick size.

A POC row is called “untouched” only **after the source candle's close**. Its source candle necessarily traded it. A later OHLC overlap resolves it as a first retest; a gap across the whole row removes it without falsely recording a trade in the row. Untouched does not mean a guaranteed future magnet. Expiry and drawing counts are bounded. Labels include row volume share and bar delta; colour, geometry, line style/width, transparency and first-retest marker shape are editable.

No footprint for a bar means unavailable, never a fabricated POC. The status panel shows current availability, the count of closed bars with usable data, and the last available timestamp. TradingView constructs footprint buy/sell categories from lower-timeframe price action: these values are not direct bid/ask aggressor prints or Level 2 resting orders. Feed coverage and historical intrabar detail can vary.

## Documentation reviewed

Primary TradingView documentation, accessed 20 October 2026:

- [Pine release notes](https://www.tradingview.com/pine-script-docs/release-notes/): January 2026 footprint requests; April 2026 UDT collection sorting; September 2026 table bottom-panel support. Native footprint materially improves the volume-at-price evidence. Collection sorting and table placement are presentation/performance conveniences, not predictive upgrades.
- [Other timeframes and data](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/): offset + lookahead pattern, footprint entitlement/one-request limit, footprint row semantics, missing data and feed differences.
- [Repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/): confirmed chart bars, HTF timing, pivot backpainting, historical-feed revisions and dataset-start effects.
- [Timeframes](https://www.tradingview.com/pine-script-docs/concepts/timeframes/): valid resolution strings and comparison by duration.
- [Objects](https://www.tradingview.com/pine-script-docs/language/objects/): UDT records keep bounds, provenance, lifecycle and drawing handles together instead of fragile parallel arrays.
- [Lines and boxes](https://www.tradingview.com/pine-script-docs/visuals/lines-and-boxes/): configurable drawings, setters, timestamp coordinates and object limits. At 120 tracked records the main script needs at most 120 boxes, 360 lines and 120 labels, below declared limits.
- [Alerts](https://www.tradingview.com/pine-script-docs/concepts/alerts/): alert conditions and close-time notification semantics.

`request.security_lower_tf()` was considered for intrabar reaction sequencing. It is not used in the main model: coverage varies by history and plan, it cannot recover true resting orders, and mixed intrabar/full-bar evidence would complicate comparisons. The conservative OHLC lifecycle states its ambiguity and gives invalidation precedence. Anchored VWAP/rolling profiles were not added as extra overlapping “AI” evidence; they would be separate hypotheses needing their own evaluation.

## Validation evidence

See `research/zones-of-interest-2026-10-20/validation.md` for the exact tested versions, TradingView results, and remaining limits. `zones-lifecycle-qa.pine` combines the actual main source with `lifecycle-assertions.inc`; it tests the same lifecycle function against synthetic cases in Pine, not a separate Python reimplementation.

Compilation, rendering and synthetic lifecycle assertions are distinct from market-quality evaluation. Establishing improvement in predictive value would require a fixed definition of reaction/attraction, chronological out-of-sample instruments/periods, zone confirmation timestamps, first-event ordering and comparison to the preserved baseline. No win rate, attraction probability, or profitability claim is made here.
