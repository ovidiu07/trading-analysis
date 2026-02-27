# Session Calendar

The backtest engine uses explicit, editable session windows with IANA timezone IDs and local session clock ranges.

## Session definition schema

Each session row supports:

- `name`
- `timezoneId` (or `zoneId` alias), for example `Europe/London`
- `localStartTime` (or `startLocal` alias)
- `localEndTime` (or `endLocal` alias)
- `enabled`
- `canGeneratePools`
- `canFilterEvaluation`
- `canFilterEntry`
- `displayOrder`

The strategy builder persists this in `sessions` and `smc.sessionCalendar`.

## Runtime resolution model

For each candle timestamp:

1. Convert UTC timestamp to the session timezone (`ZoneId`).
2. Evaluate membership against local start/end clock times.
3. Support overnight windows where start > end.
4. Emit UTC timestamps in all backtest outputs.

The effective resolved session-day object in engine terms contains:

- `sessionName`
- `sessionDateKey`
- UTC boundaries (`startUtc`, `endUtc`) implied by local conversion
- derived OHLC/high/low stats from candles assigned to that session day

## DST safety

DST is handled through timezone conversion, not fixed offsets.

Validated in tests:

- London winter/summer mapping with `Europe/London`
- New York winter/summer mapping with `America/New_York`

## Strategy-level session rules

Session filtering and cross-session behavior is controlled by:

- `sweepSourceSessions` (pool source filter)
- `evaluationSessionFilter`
- `entrySessions`
- `requireCrossSessionSweep`
- `requireSameSessionForSweepAndEntry`

Typical supported rule:

- London evaluates sweeps of Asia liquidity, entry restricted to London.

## Pool/evaluation/entry flags

Session flags provide separate toggles for where logic is allowed:

- `canGeneratePools`
- `canFilterEvaluation`
- `canFilterEntry`

This keeps pool construction, signal evaluation, and entry gating independent.

## UTC policy

- Candle storage is UTC.
- Event timeline timestamps are UTC.
- API response timestamps are ISO UTC (`...Z`).
- Backtest UI labels timestamps as UTC explicitly.
