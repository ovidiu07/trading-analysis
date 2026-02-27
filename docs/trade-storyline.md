# Trade Storyline

The backtest trade detail drawer now uses a hybrid model:

- Layer 1: Storyline (default)
- Layer 2: Diagnostics (collapsible raw timeline payloads)

This keeps beginner readability without removing engineering/debug depth.

## Storyline contract

Storyline is generated from real trade evidence + event timeline only. It does not fabricate events.

Primary sources:

- `trade.evidence` fields (`setupFamily`, `confirmationType`, pool/sweep/entry/exit prices)
- `trade.timeline` stages (`SWEEP`, `DISPLACEMENT`, `MSS_*`, `BOS_*`, `ENTRY`, `EXIT`)

## Default layout

1. Header chips
- direction
- session
- outcome
- setup family
- setup quality
- fill status

2. Key prices card
- Pool level
- Sweep extreme
- Entry
- SL
- Exit
- Retrace target

3. Progress strip
- Pool
- Sweep
- Confirmation
- Entry
- Exit

4. Narrative cards
- Context
- Liquidity Taken
- Confirmation
- Entry Setup
- Outcome

5. Key Reasons card
- concise reasons built from evidence (pool, liquidity taken, confirmation, entry model/fill, exit reason + R)

## Diagnostics layer

The `Show Diagnostics` control reveals full raw UTC event cards:

- stage name
- UTC time
- raw JSON payload

Preserved stages include:

- `POOL_CREATED`, `POOL_TARGETED`
- `SWEEP_FIRST_BREACH`, `SWEEP_EXTREME`, `SWEEP`, `POOL_CONSUMED`
- `DISPLACEMENT_FOUND`, `GAP_FOUND`, `DISPLACEMENT`
- `MSS_*` or `BOS_*` confirmation stages
- `RETRACE_TARGET_CALC`, `RETRACE_OK`
- `ENTRY`, `ENTRY_FILLED`, `EXIT`

## UTC policy in storyline

- Timeline/report timestamps are shown as UTC and rendered from ISO `Z` values.
- Storyline copy and diagnostics both stay UTC-explicit to avoid local/UTC ambiguity in backtest analysis.

## Symbol mismatch behavior

When Today header symbol differs from dataset/report instrument, the page shows a warning and a one-click reset action:

- `Use {HeaderSymbol}`

This clears stale dataset context and rebinds the wizard to the active session symbol before a new regenerate run.
