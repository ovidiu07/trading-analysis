# Breakeven — 14 October 2026

Source: `devtrader-five-sessions-fvg-windows.pine`.

## Configuration and behavior

Inputs → Strategy Breakeven contains:

- Enable Breakeven: on by default.
- Breakeven Trigger (% Of Entry-To-TP Distance): 70 by default, editable from
  0.1 through 100. Disable the checkbox to retain the original fixed stop.

The trigger is actual filled entry + (fixed TP − actual filled entry) × percent.
It is rounded toward TP to the next valid tick, so tick rounding cannot cause
early activation. For a long filled at 100 with TP 110, 70% triggers at 107;
for a short filled at 100 with TP 90, it triggers at 93.

Once observed, the existing bracket is amended to put SL at filled entry while
retaining its fixed TP, full position size, exit ID, and entry ID. The state is
latched for that trade; retracement cannot restore the original wider stop. A
stop already better than entry is never loosened. Every new plan starts fresh.

The original attached bracket still protects the entry candle. The strategy
retains close-only calculations. On the entry candle, only its confirmed close
can trigger breakeven, because a candle high/low may precede the limit fill. On
later candles, the confirmed high (long) or low (short) can trigger it. The
amendment is submitted at that candle's close and can fill from the next tick;
it does not change fills earlier in the trigger candle. Same-candle closed
trades are processed before any attempt to amend a surviving open position.

The SL drawing retains its original level until activation, then uses a separate
orange dashed line for the active breakeven stop. Setup labels, the dashboard,
and four new audit series expose the actual fill, trigger, stop, and activation.

Entry-price breakeven excludes transaction costs. Loss limits continue to use
reported closed P/L: zero breaks the streak; negative P/L from fees, slippage,
or a gap remains a loss, even when the exit comment is BE.

## Focused validation

```sh
python3 backend/src/main/resources/pine/strategies/qa-five-sessions-breakeven.py \
  --pine-output /tmp/qa-five-sessions-breakeven.pine
git diff --check
```

- PASS: 12 breakeven and 12 existing loss-limit source integration checks.
- PASS: generated Pine indicator compiled and executed on PEPPERSTONE:GER40F,
  standard 5-minute candles. The chart displayed
  `PASS 65 / 65 BE + loss-limit assertions` at approximately 15:24 Bucharest.
- The 65 assertions use the production Pine helpers verbatim and include all
  33 previous loss-limit assertions plus 32 breakeven assertions. They cover
  long/short thresholds, editable percentages, actual gap fills, tick rounding,
  invalid/missing inputs, disabled behavior, latching, monotonic stops, entry
  candle observation, new trade resets, and closed-P/L interaction.
- The temporary QA overlay was removed after verification.
- PASS: the complete updated strategy compiled without errors and was saved
  as `Devtrader · Five Sessions FVG Windows · Breakeven` at 15:29 Bucharest.
  Existing warnings remain for conditional `ta.cum` and `barstate.islast` on
  close-only strategies. Source SHA-256:
  `ca3e4426fc49acb277dffda1230f06d14337f3779b7ab5398eb456d9eea643d8`.
- PASS: the saved full strategy was temporarily added to the 5-minute chart.
  Its Inputs dialog visibly showed Strategy Breakeven, Enable Breakeven checked,
  and a trigger of 70. The temporary strategy instance was then removed and the
  previous active strategy/report restored. No historical fill audit is claimed.

These synthetic assertions validate the state logic, not an independent
trade-by-trade audit of the complete strategy or actual broker execution.
