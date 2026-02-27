# Session Calendar

The backtest session engine uses explicit, editable session windows with IANA timezones and local clock times.

## Model

Each session definition includes:

- `name`
- `timezoneId` (IANA, for example `Europe/London`)
- `localStartTime`
- `localEndTime`
- `enabled`
- `canGeneratePools`
- `canFilterEvaluation`
- `canFilterEntry`
- `displayOrder`

The UI persists this through `smc.sessionCalendar` and `sessions`.

## Resolution

At runtime the engine:

1. Reads local session windows and timezone ids.
2. Converts each candle timestamp into the session timezone.
3. Assigns session membership using local clock comparisons.
4. Supports overnight sessions (start after end).
5. Produces UTC event timestamps for output.

## DST behavior

DST is handled by Java `ZoneId` conversion (`assignSession(...)`) against the session timezone.

Examples covered in tests:

- London winter (`Europe/London`) and summer (BST) timestamps map correctly.
- New York winter/summer timestamps map correctly with `America/New_York`.

## Session-driven controls

- Session-level pool generation: `canGeneratePools`
- Setup evaluation filtering: `canFilterEvaluation`
- Entry filtering: `canFilterEntry`
- Cross-session policy:
  - `requireCrossSessionSweep`
  - `requireSameSessionForSweepAndEntry`
  - `sweepSourceSessions`
  - `evaluationSessionFilter`
  - `entrySessions`

## Recommended defaults

- ASIA: `00:00-07:00`
- LONDON: `07:00-12:00`
- NY_AM: `13:00-17:00`
- NY_PM: `17:00-22:00`

Use per-instrument templates as needed; keep engine output in UTC.
