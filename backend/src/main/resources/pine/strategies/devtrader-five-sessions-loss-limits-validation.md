# Consecutive loss limits — 14 October 2026

Source: `devtrader-five-sessions-fvg-windows.pine`.

## Behavior

- Inputs → Strategy Loss Limits: 2 consecutive losses per session and 3 per day
  by default. Each accepts 0 to disable that limit independently.
- A session is one configured First / Second / Third direction-session
  occurrence. Entry windows within that session share its streak and pause.
- A win or breakeven breaks the applicable streak. A reached limit stays
  latched until that session/day ends.
- Session attribution follows the entry plan. A trade carried into a later
  session cannot increment or reset the later session's streak.
- Daily attribution follows the closed trade's actual exit timestamp, using
  the editable Daily Reset Timezone (default Europe/Bucharest). Daily streaks
  span session changes and reset at local midnight, including across feed gaps.
- Each new closed ledger result is processed before entry eligibility. Pending
  entries are cancelled when blocked; filled positions retain their brackets.
- The dashboard shows both streaks/limits and the pause reason. Four audit
  series expose the streaks and pause flags in the data window.

## Focused validation

```sh
python3 backend/src/main/resources/pine/strategies/qa-five-sessions-loss-limits.py \
  --pine-output /tmp/qa-five-sessions-loss-limits.pine
git diff --check
```

- PASS: 12 local source integration checks and whitespace validation.
- PASS: the generated Pine indicator compiled and executed in TradingView on
  PEPPERSTONE:GER40F, standard 5-minute candles. Its chart displayed
  `PASS 33 / 33 loss-limit assertions` at approximately 15:06 Europe/Bucharest.
- The generator extracts the production Pine state/helpers verbatim. Assertions
  cover loss thresholds, wins/breakevens, independent disabled limits, latching,
  session changes, carried trades, missing P/L, actual exit dates, midnight,
  weekends/feed gaps, editable timezones, DST, and the year boundary.
- The temporary QA indicator was removed after verification.
- PASS: the complete updated strategy compiled and was saved in TradingView as
  `Devtrader · Five Sessions FVG Windows · Loss Limits` at 15:09 Europe/Bucharest.
  There were no compile errors. The compiler retained existing warnings about
  conditional `ta.cum` evaluation and `barstate.islast` on close-only strategies.
  The saved copy is ready to add to a chart; the existing chart strategy was
  not replaced during validation.

This synthetic Pine execution validates the state logic. It is not a trade-by-
trade historical audit of the complete strategy or evidence of broker fills.
