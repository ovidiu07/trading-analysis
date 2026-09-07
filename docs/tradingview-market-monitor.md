# TradingView market monitor — support and entitlement matrix

Verified against real TradingView embeds in authenticated local TradeJAudit on 2026-09-06. These are observations of symbol identity, rendering and restriction messages, not an extraction of market values. Availability may change; reverify before expanding the allowlist in `MarketMonitor.tsx`.

| Instrument | Exact symbol / provider and basis | Browser result | Native metric support | Application metrics |
|---|---|---|---|---|
| Brent | TVC:UKOIL — TVC CFD on Brent crude oil; not an ICE futures contract | Chart rendered | Daily chart OHLC; no verified ATH-distance widget metric | Custom ATH/day interval unavailable |
| WTI | TVC:USOIL — TVC CFD on WTI crude oil; not a NYMEX futures contract | Chart rendered | Daily chart OHLC; no verified ATH-distance widget metric | Custom ATH/day interval unavailable |
| US Dollar Index | TVC:DXY — TVC index-derived instrument; not ICE DX futures | TradingView-only restriction | Not available in this embed | Direct-link fallback; optional editorial macro snapshot |
| US 2Y yield | TVC:US02Y — US government bond 2-year yield, percent | TradingView-only restriction | Not available in this embed | Direct-link fallback; optional editorial yield snapshot |
| US 10Y yield | TVC:US10Y — US government bond 10-year yield, percent | TradingView-only restriction | Not available in this embed | Direct-link fallback; optional editorial yield snapshot |
| German 2Y yield | TVC:DE02Y — German government bond 2-year yield, percent | TradingView-only restriction | Not available in this embed | Direct-link fallback; optional editorial yield snapshot |
| German 10Y yield | TVC:DE10Y — German government bond 10-year yield, percent | TradingView-only restriction | Not available in this embed | Direct-link fallback; optional editorial yield snapshot |
| DAX | XETR:DAX — XETR cash index | Chart rendered | Daily chart OHLC; no verified ATH-distance widget metric | Custom ATH/day interval unavailable |
| Nasdaq-100 | NASDAQ:NDX — NASDAQ cash index | TradingView-only restriction | Not available in this embed | Direct-link fallback |
| ES | CME_MINI:ES1! — CME continuous front-contract futures series; not a specified expiry | TradingView-only restriction | Not available in this embed | Direct-link fallback; no historical ATH claim |

Only browser-confirmed chart symbols are embedded. Restricted symbols retain visible identity and direct TradingView links without repeatedly loading a known-denied iframe. A future supported alternative must be identified as a different instrument, never silently substituted. Yield identities were also checked against TradingView's official symbol pages: [US02Y](https://www.tradingview.com/symbols/TVC-US02Y/), [US10Y](https://www.tradingview.com/symbols/TVC-US10Y/), [DE02Y](https://www.tradingview.com/symbols/TVC-DE02Y/), [DE10Y](https://www.tradingview.com/symbols/TVC-DE10Y/). These are yields; no bond-futures price substitution is used.

There is no separate authorized, configured market-data source for custom metrics in this release. Existing user-scoped provider adapters do not establish shared data entitlement and are not required. Optional macro snapshots have exact instrument/type, source, observation time, unit, reference value/time and availability. They are labelled editor-published snapshots. Yield levels require `%`; a compatible pair of published yield observations can display its difference in basis points. This is not a daily yield range.

**ATH distance:** omitted. There is no verified complete history, ATH date, adjustment basis or futures roll methodology for an application calculation. A 52-week high is not treated as ATH. Unsupported `ath`, `athDistance`, and widget-value fields are rejected by the importer. No positive/zero/negative price percentage is fabricated.

**Current-day low–high/width:** omitted as an application metric. The chart's visible daily candle can be previous/selected or incomplete; its provider trading day may include overnight activity. No final daily candle is retroactively inserted into an earlier preparation. No reference-open percentage or yield range is inferred from the iframe. There are therefore no supported application-level ATH or day-range calculation contracts to test in this release; negative import tests prevent accepting unsupported metrics.

The official Advanced Chart embed runs inside a disposable iframe document, preserving its script, branding, status indicators and attribution link. The wrapper gives every chart ancestor a concrete height. Private plan/journal edits do not change chart configuration or iframe document. Symbol/theme/interval changes intentionally reload the widget document. This also prevents React step teardown from leaving the asynchronous vendor script attached to a removed parent element.

Official documentation checked:

- [Widget documentation](https://www.tradingview.com/widget-docs/)
- [Advanced Chart settings](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/)
- [Data FAQ](https://www.tradingview.com/widget-docs/faq/data/): entitlement restrictions, no export/API for widget values, personal paid plans do not upgrade website data.
- [General FAQ](https://www.tradingview.com/widget-docs/faq/general/): explicit parent dimensions, attribution and available configuration.
- [Terms and policies](https://www.tradingview.com/policies/): display and attribution obligations.
- [TVC instrument definitions](https://www.tradingview.com/support/solutions/43000709178-what-does-tvc-stand-for-in-the-instrument-ticker/).

No subscription was purchased, license accepted, private API intercepted, unofficial socket opened, or widget-value scraper/OCR implemented. External telemetry fetch failures observed during browser checks are documented separately; they are not market-data entitlement upgrades or evidence of live values.
