#!/usr/bin/env python3
"""Check loss-limit wiring and generate a harness using the exact Pine helpers.

Run this script locally, then compile/add the generated indicator in TradingView.
A green PASS table confirms the Pine assertions ran; generation alone does not.
"""

import argparse
from pathlib import Path


SOURCE = Path(__file__).with_name("devtrader-five-sessions-fvg-windows.pine")


def build_harness(source: str) -> tuple[str, int]:
    # Copy the production implementation verbatim, rather than testing a model
    # of it in another language. Expected outcomes below express the contract.
    helpers = source.split("type LossLimitState\n", 1)[1].split(
        "var LossLimitState lossLimitState", 1
    )[0]
    lines = [
        '//@version=6',
        'indicator("QA · Five Sessions Loss Limits", overlay=true)',
        "type LossLimitState\n" + helpers,
        "f_assert(bool condition, string description) =>",
        "    if not condition",
        '        runtime.error("FAIL: " + description)',
        "    1",
        "var int passed = 0",
        "if barstate.isfirst",
        '    string tz = "Europe/Bucharest"',
        '    int morning = timestamp(tz, 2026, 10, 14, 10, 0)',
        '    int afternoon = timestamp(tz, 2026, 10, 14, 16, 0)',
        '    int midnight = timestamp(tz, 2026, 10, 15, 0, 0)',
    ]
    checks = 0

    def step(code: str) -> None:
        lines.append("    " + code)

    def check(condition: str, description: str) -> None:
        nonlocal checks
        checks += 1
        step(f'passed += f_assert({condition}, "{description}")')

    def record(state: str, session: str, stamp: str, pnl: str, sl="2", dl="3") -> None:
        step(f"f_recordLossResult({state}, {session}, {stamp}, {pnl}, {sl}, {dl}, tz)")

    step("LossLimitState s = LossLimitState.new()")
    step("f_syncLossSession(s, morning)")
    step("f_syncLossDay(s, morning, tz)")
    check("f_lossEntriesAllowed(s) and s.sessionStreak == 0 and s.dailyStreak == 0", "initial state")
    record("s", "morning", "morning", "-100")
    check("f_lossEntriesAllowed(s) and s.sessionStreak == 1 and s.dailyStreak == 1", "first loss permits another entry")
    record("s", "morning", "morning", "150")
    check("s.sessionStreak == 0 and s.dailyStreak == 0", "win breaks both streaks")
    record("s", "morning", "morning", "-100")
    record("s", "morning", "morning", "0")
    check("s.sessionStreak == 0 and s.dailyStreak == 0", "breakeven breaks both streaks")
    record("s", "morning", "morning", "-100")
    record("s", "morning", "morning", "-100")
    check("s.sessionPaused and not s.dailyPaused and not f_lossEntriesAllowed(s)", "second consecutive session loss pauses entries")
    step("f_syncLossSession(s, morning)")
    check("s.sessionStreak == 2 and s.sessionPaused", "same session or a new entry window cannot reset pause")
    step("f_syncLossSession(s, na)")
    check("s.sessionPaused", "gap outside sessions cannot clear a pause")
    step("f_syncLossSession(s, afternoon)")
    check("s.sessionStreak == 0 and not s.sessionPaused and s.dailyStreak == 2", "new session resets only session state")
    record("s", "afternoon", "afternoon", "-100")
    check("s.dailyPaused and s.dailyStreak == 3 and s.sessionStreak == 1", "third daily consecutive loss across sessions pauses entries")
    check("not f_lossEntriesAllowed(s)", "daily pause blocks entries below session limit")
    step("f_syncLossSession(s, afternoon + 3600000)")
    check("s.dailyPaused and not s.sessionPaused and not f_lossEntriesAllowed(s)", "another session cannot bypass daily pause")
    record("s", "afternoon + 3600000", "afternoon", "150")
    check("s.dailyStreak == 0 and s.dailyPaused", "daily pause stays latched after a later win")
    step("f_syncLossDay(s, midnight, tz)")
    check("not s.dailyPaused and s.dailyStreak == 0 and f_lossEntriesAllowed(s)", "midnight releases daily pause")

    step("LossLimitState carry = LossLimitState.new()")
    step("f_syncLossSession(carry, afternoon)")
    record("carry", "morning", "afternoon", "-100")
    check("carry.dailyStreak == 1 and carry.sessionStreak == 0", "carried loss counts for exit day but not next session")
    record("carry", "afternoon", "afternoon", "-100")
    record("carry", "morning", "afternoon", "150")
    check("carry.dailyStreak == 0 and carry.sessionStreak == 1", "carried win cannot reset next session streak")
    record("carry", "afternoon", "afternoon", "-100")
    check("carry.sessionPaused and not carry.dailyPaused", "session cap remains independent of daily sequence")
    record("carry", "afternoon", "afternoon", "0")
    check("carry.sessionPaused and carry.sessionStreak == 0", "session pause stays latched after breakeven")
    step("f_syncLossDay(carry, midnight, tz)")
    check("carry.sessionPaused and not f_lossEntriesAllowed(carry)", "midnight cannot release an overnight session pause")
    step("f_syncLossSession(carry, midnight + 3600000)")
    check("f_lossEntriesAllowed(carry)", "new overnight session releases remaining pause")

    step("LossLimitState off = LossLimitState.new()")
    step("f_syncLossSession(off, morning)")
    step("for i = 0 to 4")
    step("    f_recordLossResult(off, morning, morning, -100, 0, 0, tz)")
    check("off.sessionStreak == 5 and off.dailyStreak == 5 and f_lossEntriesAllowed(off)", "zero independently disables both limits")
    record("off", "morning", "morning", "-100", sl="0", dl="6")
    check("off.dailyPaused and not off.sessionPaused", "editable daily threshold with session limit disabled")
    step("LossLimitState one = LossLimitState.new()")
    step("f_syncLossSession(one, morning)")
    record("one", "morning", "morning", "-0.01", sl="1", dl="0")
    check("one.sessionPaused and not one.dailyPaused", "editable one-loss threshold uses actual P/L")
    step("LossLimitState unknown = LossLimitState.new()")
    step("f_syncLossSession(unknown, morning)")
    record("unknown", "na", "morning", "-100")
    check("unknown.dailyStreak == 1 and unknown.sessionStreak == 0", "unknown entry owner cannot contaminate session streak")
    record("unknown", "morning", "morning", "na")
    check("unknown.dailyStreak == 1 and unknown.sessionStreak == 0", "unavailable P/L is not a breakeven")

    step("LossLimitState edge = LossLimitState.new()")
    step("f_syncLossSession(edge, afternoon)")
    record("edge", "afternoon", "midnight - 1", "-100", sl="0", dl="1")
    check("edge.dayKey == 20261014 and edge.dailyPaused", "exit before midnight belongs to yesterday")
    step("f_syncLossDay(edge, midnight, tz)")
    check("edge.dayKey == 20261015 and not edge.dailyPaused and edge.dailyStreak == 0", "midnight bar processes exits before next-day entry gate")
    record("edge", "afternoon", "midnight", "-100", sl="0", dl="1")
    check("edge.dayKey == 20261015 and edge.dailyStreak == 1 and edge.dailyPaused", "exit exactly at midnight belongs to new day")
    step("f_syncLossDay(edge, timestamp(tz, 2026, 10, 19, 10, 0), tz)")
    check("edge.dailyStreak == 0 and not edge.dailyPaused", "feed gap or weekend resets daily state")
    check('f_lossDayKey(timestamp("UTC", 2026, 10, 14, 21, 30), tz) == 20261015', "Bucharest date rather than exchange or chart date")
    check('f_lossDayKey(timestamp("UTC", 2026, 10, 14, 21, 30), "America/New_York") == 20261014', "editable reset timezone changes date attribution")
    check('f_lossDayKey(timestamp("UTC", 2026, 10, 25, 21, 30), tz) == 20261025', "Bucharest DST fall-back uses correct date")
    check('f_lossDayKey(timestamp("UTC", 2026, 10, 25, 22, 0), tz) == 20261026', "midnight after DST fall-back")
    check('f_lossDayKey(timestamp(tz, 2027, 1, 1, 0, 0), tz) == 20270101', "year boundary has a distinct day key")
    lines.extend([
        'var table result = table.new(position.bottom_left, 1, 1)',
        "if barstate.islastconfirmedhistory or barstate.islast",
        f'    table.cell(result, 0, 0, "PASS " + str.tostring(passed) + " / {checks} loss-limit assertions", text_color=color.white, bgcolor=color.green)',
    ])
    return "\n".join(lines) + "\n", checks


def check_wiring(source: str) -> int:
    requirements = [
        'maximumSessionConsecutiveLosses = input.int(2,',
        'maximumDailyConsecutiveLosses = input.int(3,',
        'dailyLossResetTimezone = input.string("Europe/Bucharest",',
        'if nativeMode and lossEntriesAllowed and directionReady and free',
        'if not lossEntriesAllowed or not nativeMode or expired',
        'strategy.closedtrades.exit_time(i), strategy.closedtrades.profit(i)',
        'int tradeSessionStart = ownsPlan ? activePlan.sessionStart : na',
        'f_syncLossSession(lossLimitState, fiveOccurrenceStart)',
        'processedClosed := strategy.closedtrades',
        'calc_on_every_tick=false, calc_on_order_fills=false',
    ]
    for expected in requirements:
        assert expected in source, f"Missing source integration: {expected}"
    ledger = source.index("f_recordLossResult(lossLimitState,")
    day_roll = source.index("f_syncLossDay(lossLimitState, time_close,")
    gate = source.index("if nativeMode and lossEntriesAllowed and directionReady")
    assert ledger < day_roll < gate, "Closed results and day rollover must precede entries"
    assert "strategy.close(" not in source and "strategy.close_all(" not in source
    return len(requirements) + 2


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pine-output", type=Path, required=True)
    args = parser.parse_args()
    source = SOURCE.read_text()
    count = check_wiring(source)
    pine, assertions = build_harness(source)
    args.pine_output.write_text(pine)
    print(f"PASS {count} source integration checks")
    print(f"Generated {assertions} Pine runtime assertions: {args.pine_output}")
    print("Runtime validation requires a green PASS table in TradingView.")


if __name__ == "__main__":
    main()
