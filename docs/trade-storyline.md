# Trade Storyline

## Default View (Storyline)
Storyline is the default trade-detail mode and answers:
1. What was the setup?
2. What liquidity was taken?
3. What confirmed the idea?
4. Why was entry valid?
5. Why did it win/lose?

## Layout Contract
1. Header summary (direction/session/outcome/setup/quality/fill)
2. Horizontal progress strip (Pool -> Sweep -> Confirmation -> Entry -> Exit)
3. Vertical story cards:
- Context
- Liquidity Taken
- Confirmation
- Entry Setup
- Outcome
4. Key Reasons card
5. Collapsible diagnostics section

## Diagnostics View (Collapsed By Default)
Raw event cards keep full engineering fidelity:
- stage
- UTC timestamp
- JSON payload

Preserved event stages include:
- pool lifecycle events
- sweep events
- displacement/gap events
- MSS/BOS trigger and confirmation
- retrace target/ok
- entry/fill/exit

## Data Source Rules
Storyline is generated from actual payloads only:
- `trade.evidence`
- `trade.timeline`
- candidate evidence when no converted trade exists

No synthetic timeline events are fabricated.

## UTC Policy
- Storyline and diagnostics both display UTC (`Z`) timestamps.
- This avoids local/UTC ambiguity when validating CSV-driven backtests.

## Symbol Context Guardrail
When Today header symbol differs from dataset/report symbol, the UI shows a warning and reset action to avoid cross-symbol misreads.
