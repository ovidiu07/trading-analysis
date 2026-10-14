#!/usr/bin/env python3
"""Generate assertions against the production Pine helpers, including BE/loss QA.

Generation/source checks are local evidence only. Execute the result in
TradingView to validate the Pine assertions and compile the full strategy.
"""
import argparse
import importlib.util
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).parent
SOURCE = HERE / "devtrader-five-sessions-fvg-windows.pine"


def build_harness(source):
    spec = importlib.util.spec_from_file_location("be_qa", HERE / "qa-five-sessions-breakeven.py")
    be_qa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(be_qa)
    be_wiring = be_qa.check_wiring(source)
    base, count, loss_wiring = be_qa.build_harness(source)
    base = base.split("var table result =", 1)[0]
    helpers = source.split("f_fvgEntry(", 1)[1].split("f_stopPrice(", 1)[0]
    helpers = "f_fvgEntry(" + helpers
    start = helpers.index("f_entryPrice(")
    end = helpers.index("// Fill depth")
    helpers = helpers[:start] + helpers[end:]
    capture = source.split("type TradePlan\n", 1)[1].split("f_fvgEntryComment(", 1)[0]
    capture = "type TradePlan\n" + capture
    base = base.replace("f_assert(bool condition, string description) =>", helpers + capture + "\nf_assert(bool condition, string description) =>")
    base = base.replace('indicator("QA · Five Sessions Breakeven + Loss Limits",', 'indicator("QA · FVG Report + BE + Loss Limits",')
    lines = [base, "if barstate.isfirst"]

    def step(code):
        lines.append("    " + code)

    def check(condition, description):
        nonlocal count
        count += 1
        step(f'passed += f_assert({condition}, "{description}")')

    check("f_fvgEntry(110, 100, 1, true, 25, 0.1) == 107.5", "long configured percentage entry")
    check("f_fvgEntry(110, 100, -1, true, 25, 0.1) == 102.5", "short configured percentage entry")
    check("f_fvgEntry(110, 100, 1, false, 75, 0.1) == 110", "disabled percentage enters bullish near edge")
    check("f_fvgEntry(110, 100, -1, false, 75, 0.1) == 100", "disabled percentage enters bearish near edge")
    check("f_fvgEntry(110, 100, 1, true, 100, 0.1) == 100", "100 percent long is far edge")
    check("f_fvgEntry(110, 100, -1, true, 100, 0.1) == 110", "100 percent short is far edge")
    check("f_fvgDepth(110, 100, 1, 107.5) == 25", "actual bullish fill depth")
    check("f_fvgDepth(110, 100, -1, 102.5) == 25", "actual bearish fill depth")
    check("f_fvgDepth(110, 100, 1, 98) == 120", "gap fill beyond zone remains visible")
    check("na(f_fvgDepth(100, 100, 1, 100))", "zero width depth is unavailable")
    check("math.abs(f_fvgSizePercent(110, 100, 1) - 10) < 0.000001", "bullish size matches detector denominator")
    check("math.abs(f_fvgSizePercent(110, 100, -1) - 1000.0 / 110) < 0.000001", "bearish size matches detector denominator")
    check("na(f_fvgSizePercent(10, 0, 1))", "zero reference price is unavailable")
    check("f_fvgTouched(110, 100, 115, 110)", "near-edge touch counts")
    check("f_fvgTouched(110, 100, 105, 99)", "partial overlap counts")
    check("not f_fvgTouched(110, 100, 115, 111)", "range above gap does not count")
    check("not f_fvgTouched(110, 100, 99, 95)", "gap-through without range overlap is distinct")
    check("f_fvgFillBars(10, 11) == 1", "next chart candle is one bar after confirmation")
    check("f_fvgFillBars(10, 18) == 8", "queued gap retains creation age")
    check("na(f_fvgFillBars(10, 9))", "pre-creation fill age is unavailable")
    step('TradePlan p = TradePlan.new(0, 0, 0, 1000000, 1, "TEST", 107.5, 95, 130, 110, 100, 0, 300000, 10)')
    step("f_captureFvgFill(p, 106, 15, 1500000)")
    check("p.actualEntry == 106 and p.entryBar == 15 and p.firstTouchBar == 15", "closed-ledger fill works without an open observation")
    step("f_captureFvgFill(p, 105, 16, 1800000)")
    check("p.actualEntry == 106 and p.entryBar == 15", "fill capture is idempotent")
    step('TradePlan earlierTouch = TradePlan.new(0, 0, 0, 1000000, -1, "TEST2", 102.5, 115, 80, 110, 100, 0, 300000, 10, firstTouchBar=12)')
    step("f_captureFvgFill(earlierTouch, 102.5, 15, 1500000)")
    check("earlierTouch.firstTouchBar == 12 and earlierTouch.entryBar == 15", "first touch remains separate from deeper entry")
    step("FvgTradeAudit audit = FvgTradeAudit.new(1, p, 1800000, 130, 120, 2, \"TP\")")
    step("array.push(fvgTradeHistory, audit)")
    check("array.get(fvgTradeHistory, 0).plan.actualEntry == 106", "closed audit survives a separate replacement plan")
    lines += ["var table result = table.new(position.bottom_left, 1, 1)", "if barstate.islastconfirmedhistory or barstate.islast", f'    table.cell(result, 0, 0, "PASS " + str.tostring(passed) + " / {count} FVG + BE + loss assertions", text_color=color.white, bgcolor=color.green)']
    return "\n".join(lines) + "\n", count, be_wiring + loss_wiring


def check_wiring(source):
    requirements = [
        'useFvgEntryPercentage = input.bool(true,',
        'active=useFvgEntryPercentage',
        'candidate.createdChartBar, firstTouchBar=candidate.firstTouchBar',
        'f_captureFvgFill(activePlan, strategy.closedtrades.entry_price(i)',
        'f_captureFvgFill(activePlan, strategy.position_avg_price',
        'array.push(fvgTradeHistory, closedFvgAudit)',
        'FvgTradeAudit closedFvgAudit = na',
        'TradePlan closedFvgPlan = na(closedFvgAudit) ? na : closedFvgAudit.plan',
        'comment=f_fvgEntryComment(activePlan, ew.tag)',
        '"FVG_TRADE_V1,"',
    ]
    for text in requirements:
        assert text in source, text
    capture = source.index("f_captureFvgFill(activePlan, strategy.closedtrades.entry_price(i)")
    record = source.index("array.push(fvgTradeHistory, closedFvgAudit)")
    cleanup = source.index("activePlan := na", capture)
    new_plan = source.index("activePlan := TradePlan.new(")
    assert capture < record < cleanup < new_plan
    assert source.count("\nplot(") <= 64
    return len(requirements) + 2


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pine-output", type=Path, required=True)
    args = parser.parse_args()
    source = SOURCE.read_text()
    wiring = check_wiring(source)
    pine, count, inherited_wiring = build_harness(source)
    args.pine_output.write_text(pine)
    print(f"PASS {wiring + inherited_wiring} source integration checks")
    print(f"Generated {count} assertions in {args.pine_output}; TradingView execution still required")
