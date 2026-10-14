#!/usr/bin/env python3
"""Generate Pine runtime assertions for breakeven and existing loss limits.

Production helpers are copied verbatim. Run the generated indicator in
TradingView and verify its green PASS table; local generation is not execution.
"""

import argparse
import importlib.util
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).parent
SOURCE = HERE / "devtrader-five-sessions-fvg-windows.pine"


def build_harness(source: str) -> tuple[str, int, int]:
    spec = importlib.util.spec_from_file_location("loss_qa", HERE / "qa-five-sessions-loss-limits.py")
    loss_qa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loss_qa)
    integration_count = loss_qa.check_wiring(source)
    base, loss_count = loss_qa.build_harness(source)
    helpers = "type BreakevenState\n" + source.split("type BreakevenState\n", 1)[1].split(
        "// --- A single pending/open plan;", 1
    )[0]
    base = base.split("var table result =", 1)[0].replace(
        "f_assert(bool condition, string description) =>", helpers + "\nf_assert(bool condition, string description) =>"
    ).replace('indicator("QA · Five Sessions Loss Limits",', 'indicator("QA · Five Sessions Breakeven + Loss Limits",')
    lines = [base, "if barstate.isfirst"]
    checks = 0

    def step(code: str) -> None:
        lines.append("    " + code)

    def check(condition: str, description: str) -> None:
        nonlocal checks
        checks += 1
        step(f'passed += f_assert({condition}, "{description}")')

    check("math.abs(f_breakevenTrigger(100, 110, 70, 1, 0.1) - 107) < 0.000001", "long default trigger is 70 percent to TP")
    check("math.abs(f_breakevenTrigger(100, 90, 70, -1, 0.1) - 93) < 0.000001", "short default trigger is 70 percent to TP")
    check("math.abs(f_breakevenTrigger(100, 110, 50, 1, 0.1) - 105) < 0.000001", "editable 50 percent trigger")
    check("math.abs(f_breakevenTrigger(100, 110, 100, 1, 0.1) - 110) < 0.000001", "100 percent is TP itself")
    check("math.abs(f_breakevenTrigger(98, 110, 70, 1, 0.1) - 106.4) < 0.000001", "gap fill uses actual entry rather than planned entry")
    check("math.abs(f_breakevenTrigger(100, 101, 70, 1, 0.25) - 100.75) < 0.000001", "long fractional trigger rounds toward TP")
    check("math.abs(f_breakevenTrigger(100, 99, 70, -1, 0.25) - 99.25) < 0.000001", "short fractional trigger rounds toward TP")
    check("na(f_breakevenTrigger(100, 100, 70, 1, 0.1))", "zero reward cannot activate")
    check("na(f_breakevenTrigger(100, 99, 70, 1, 0.1))", "wrong-side TP cannot activate")
    check("na(f_breakevenTrigger(100, 110, 0, 1, 0.1)) and na(f_breakevenTrigger(100, 110, 101, 1, 0.1))", "invalid percentage cannot activate")
    check("na(f_breakevenTrigger(100, 110, 70, 1, 0))", "invalid tick cannot activate")
    step("BreakevenState longTrade = BreakevenState.new(100, 107, 95)")
    check("not f_armBreakeven(longTrade, false, 1, 109, 1000) and longTrade.stop == 95", "disabled breakeven keeps original stop")
    check("not f_armBreakeven(longTrade, true, 1, 106.9, 1000) and not longTrade.active", "below-trigger long remains at risk")
    check("f_armBreakeven(longTrade, true, 1, 107, 2000) and longTrade.stop == 100 and longTrade.active", "long exact touch moves stop to filled entry")
    check("longTrade.activatedAt == 2000", "activation time is the observation close")
    check("not f_armBreakeven(longTrade, true, 1, 96, 3000) and longTrade.stop == 100 and longTrade.activatedAt == 2000", "retracement cannot undo or redraw activation")
    step("BreakevenState shortTrade = BreakevenState.new(100, 93, 105)")
    check("not f_armBreakeven(shortTrade, true, -1, 93.1, 1000) and shortTrade.stop == 105", "above-trigger short remains at risk")
    check("f_armBreakeven(shortTrade, true, -1, 92.9, 2000) and shortTrade.stop == 100", "short crossing moves stop to filled entry")
    check("not f_armBreakeven(shortTrade, true, -1, 104, 3000) and shortTrade.stop == 100", "short retracement keeps breakeven latched")
    step("BreakevenState betterLong = BreakevenState.new(100, 107, 101)")
    step("f_armBreakeven(betterLong, true, 1, 108, 1000)")
    check("betterLong.stop == 101", "existing better long stop is never loosened")
    step("BreakevenState betterShort = BreakevenState.new(100, 93, 99)")
    step("f_armBreakeven(betterShort, true, -1, 92, 1000)")
    check("betterShort.stop == 99", "existing better short stop is never loosened")
    step("BreakevenState missing = BreakevenState.new(100, na, 95)")
    check("not f_armBreakeven(missing, true, 1, 108, 1000) and missing.stop == 95", "unavailable trigger leaves bracket unchanged")
    check("not f_armBreakeven(missing, true, 1, na, 1000)", "missing observed price cannot activate")
    check("f_breakevenObservation(1, 10, 10, 103, 109, 99) == 103", "entry candle long ignores possible pre-fill high")
    check("f_breakevenObservation(-1, 10, 10, 97, 101, 91) == 97", "entry candle short ignores possible pre-fill low")
    check("f_breakevenObservation(1, 11, 10, 103, 109, 99) == 109", "later long candle uses its high")
    check("f_breakevenObservation(-1, 11, 10, 97, 101, 91) == 91", "later short candle uses its low")
    step("BreakevenState entryBar = BreakevenState.new(100, 107, 95)")
    check("not f_armBreakeven(entryBar, true, 1, f_breakevenObservation(1, 10, 10, 103, 109, 99), 1000)", "entry-bar pre-fill wick cannot arm stop")
    check("f_armBreakeven(entryBar, true, 1, f_breakevenObservation(1, 10, 10, 108, 109, 99), 1000)", "entry-bar confirmed close can arm stop")
    step("BreakevenState fresh = BreakevenState.new(200, 207, 195)")
    check("not fresh.active and na(fresh.activatedAt) and fresh.stop == 195", "next trade starts without prior breakeven state")
    step("LossLimitState beResult = LossLimitState.new()")
    step("f_syncLossSession(beResult, 1000)")
    step('f_recordLossResult(beResult, 1000, 1000, -100, 2, 3, "UTC")')
    step('f_recordLossResult(beResult, 1000, 1000, 0, 2, 3, "UTC")')
    check("beResult.sessionStreak == 0 and beResult.dailyStreak == 0 and f_lossEntriesAllowed(beResult)", "zero-P/L breakeven breaks loss streaks")
    step('f_recordLossResult(beResult, 1000, 1000, -1, 2, 3, "UTC")')
    check("beResult.sessionStreak == 1 and beResult.dailyStreak == 1", "negative P/L after BE fees or gap is still a loss")
    check("math.abs(f_breakevenLock(100, 130, 30, 1, 0.1) - 109) < 0.000001", "1 to 3 long locks 0.9R at 30 percent of target")
    check("math.abs(f_breakevenLock(100, 70, 30, -1, 0.1) - 91) < 0.000001", "1 to 3 short locks 0.9R at 30 percent of target")
    check("f_breakevenLock(100, 130, 0, 1, 0.1) == 100", "zero lock preserves entry-price breakeven")
    check("f_breakevenLock(100, 101, 30, 1, 0.25) == 100.25", "long lock rounds toward entry")
    check("f_breakevenLock(100, 99, 30, -1, 0.25) == 99.75", "short lock rounds toward entry")
    check("na(f_breakevenLock(100, 100, 30, 1, 0.1)) and na(f_breakevenLock(100, 130, 100, 1, 0.1))", "invalid lock cannot produce a protected level")
    step("BreakevenState protectedLong = BreakevenState.new(100, 127, 90, protectedStop=109)")
    check("not f_armBreakeven(protectedLong, true, 1, 126.9, 1000) and protectedLong.stop == 90", "90 percent trigger does not arm early")
    check("f_armBreakeven(protectedLong, true, 1, 127, 2000) and protectedLong.stop == 109", "90 percent trigger locks 30 percent for a long")
    check("not f_armBreakeven(protectedLong, true, 1, 101, 3000) and protectedLong.stop == 109", "profit lock cannot loosen on retracement")
    step("BreakevenState protectedShort = BreakevenState.new(100, 73, 110, protectedStop=91)")
    check("f_armBreakeven(protectedShort, true, -1, 73, 2000) and protectedShort.stop == 91", "90 percent trigger locks 30 percent for a short")
    step("BreakevenState tighter = BreakevenState.new(100, 127, 112, protectedStop=109)")
    step("f_armBreakeven(tighter, true, 1, 127, 2000)")
    check("tighter.stop == 112", "configured protection cannot loosen a better stop")
    total = loss_count + checks
    lines.extend([
        "var table result = table.new(position.bottom_left, 1, 1)",
        "if barstate.islastconfirmedhistory or barstate.islast",
        f'    table.cell(result, 0, 0, "PASS " + str.tostring(passed) + " / {total} BE + loss-limit assertions", text_color=color.white, bgcolor=color.green)',
    ])
    return "\n".join(lines) + "\n", total, integration_count


def check_wiring(source: str) -> int:
    requirements = [
        'enableBreakeven = input.bool(true,',
        'breakevenTriggerPercent = input.float(70.0,',
        'float filledEntry = strategy.position_avg_price',
        'strategy.opentrades.entry_bar_index(0), close, high, low',
        'f_armBreakeven(activePlan.breakeven, enableBreakeven, activePlan.bias, observedPrice, time_close)',
        'strategy.exit(activePlan.orderId + "-EXIT", from_entry=activePlan.orderId, stop=activePlan.breakeven.stop, limit=activePlan.target',
        'comment_loss=(activePlan.breakeven.active ? "BE" : "SL") + fillComment',
        'breakevenLockPercent = input.float(0.0,',
        'enableBreakeven and breakevenLockPercent >= breakevenTriggerPercent',
        'protectedStop=f_breakevenLock(filledEntry, activePlan.target, breakevenLockPercent',
        'strategy.exit(orderId + "-EXIT", from_entry=orderId, stop=stop, limit=target',
        'line.delete(p.breakevenStopLine)',
        'p.breakeven.activatedAt : endTime',
        'calc_on_every_tick=false, calc_on_order_fills=false',
    ]
    for requirement in requirements:
        assert requirement in source, f"Missing integration: {requirement}"
    ledger = source.index("f_recordLossResult(lossLimitState,")
    open_position = source.index("if not na(activePlan) and strategy.position_size != 0")
    amend = source.index('strategy.exit(activePlan.orderId + "-EXIT",')
    pending = source.index("if not na(activePlan) and not activePlan.filled\n")
    assert ledger < open_position < amend < pending, "Amend only a surviving filled position after processing closures"
    return len(requirements) + 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pine-output", required=True, type=Path)
    args = parser.parse_args()
    source = SOURCE.read_text()
    wiring = check_wiring(source)
    pine, count, loss_wiring = build_harness(source)
    args.pine_output.write_text(pine)
    print(f"PASS {wiring} breakeven + {loss_wiring} loss-limit source integration checks")
    print(f"Generated {count} Pine runtime assertions: {args.pine_output}")
    print("Runtime validation requires a green PASS table in TradingView.")


if __name__ == "__main__":
    main()
