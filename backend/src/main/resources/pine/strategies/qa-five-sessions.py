"""Focused acceptance checks + audits of actual TradingView CSV exports.

Formula fixtures evaluate expressions extracted from the delivered Pine source.
Chart checks independently aggregate raw OHLC, never use the plotted session high
as their oracle. Trade checks use actual emulator exits, not a parallel fill model.
This is not a Pine compiler or proof of real broker fills.
"""
import csv
import datetime as dt
import math
from collections import Counter, defaultdict
from pathlib import Path
from types import SimpleNamespace as NS
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
SOURCE = (ROOT / 'devtrader-fvg-trend-continuation.pine').read_text()
TZ = ZoneInfo('Europe/Bucharest')
STEP = dt.timedelta(minutes=5)


def expression(prefix):
    matches = [line.strip()[len(prefix):] for line in SOURCE.splitlines() if line.strip().startswith(prefix)]
    matches = [m for m in matches if m not in ('0', 'na')]
    assert len(matches) == 1, (prefix, matches)
    return matches[0]


def ternary(code):
    # Convert the top-level Pine ternaries used in the inspected scalar formulas.
    depth = 0
    quote = None
    question = None
    nested = 0
    for i, char in enumerate(code):
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ('"', "'"):
            quote = char
        elif char in '([':
            depth += 1
        elif char in ')]':
            depth -= 1
        elif depth == 0 and char == '?':
            if question is None:
                question = i
            else:
                nested += 1
        elif depth == 0 and char == ':' and question is not None:
            if nested:
                nested -= 1
            else:
                return f'({ternary(code[question+1:i].strip())} if {ternary(code[:question].strip())} else {ternary(code[i+1:].strip())})'
    return code


def value(prefix, **variables):
    code = ternary(expression(prefix))
    return eval(code, {'__builtins__': {}, 'na': lambda x: x is None, 'math': NS(min=min, max=max, floor=math.floor), 'true': True, 'false': False}, variables)


def fixtures():
    count = 0
    for price, expected in [(20050, 1), (19950, -1), (20000, 0)]:
        assert value('s.bias := ', close=price, s=NS(referenceHigh=20000)) == expected
        count += 1
    for lower, upper, threshold, valid in [(20000, 20012, .05, True), (20000, 20006, .05, False)]:
        percent = value('float percent = ', midpoint=(lower+upper)/2, width=upper-lower)
        assert (percent >= threshold) == valid
        count += 1
    for side, lower, upper, expected in [(1, 20000, 20020, 20006), (-1, 19980, 20000, 19994)]:
        assert value('s.entry := ', s=NS(bias=side), lower=lower, upper=upper, width=upper-lower, entryDepthPercent=30) == expected
        count += 1
    for side, entry, stop, expected in [(1, 20000, 19980, 20030), (-1, 20000, 20020, 19970)]:
        s = NS(bias=side, entry=entry, stop=stop)
        risk = value('float risk = ', s=s)
        assert value('s.target := ', s=s, risk=risk, rewardRiskRatio=1.5) == expected
        count += 1
    gate = expression('if risk > ')  # Actual source SL gate: restore stripped prefix.
    gate = 'risk > ' + gate
    for risk, valid in [(45, False), (40, True), (0, False)]:
        assert eval(gate, {'__builtins__': {}}, {'risk': risk, 'maxStopPoints': 40}) == valid
        count += 1
    for side, current, proposed, preferred in [(1, (20000,20020), (20025,20045), False), (-1, (20100,20120), (20070,20090), False)]:
        # Preferred expression contains an inner ternary, evaluated separately.
        s = NS(bias=side, lower=current[0], upper=current[1])
        code = expression('bool preferred = ')
        inner = code[code.index('(s.bias'):].strip('()')
        assert eval(ternary(inner), {'__builtins__': {}}, {'s': s, 'midpoint': sum(proposed)/2}) == preferred
        count += 1
    for trades, result, allowed in [(0,'NONE',True), (1,'SL',True), (1,'TP',False), (2,'SL',False), (1,'OTHER',False)]:
        assert value('bool allowance = ', s=NS(finished=False,trades=trades,firstResult=result), maximumTradesPerSession=2) == allowed
        count += 1
    # Expiration is fixed from original activation, clipped to window end.
    for activation, window, expiry in [(635,735,695), (700,735,735)]:
        assert value('int expires = ', activated=activation*60000, orderValidityMinutes=60, s=NS(windowEnd=window*60000)) == expiry*60000
        count += 1
    for minute, active_window in [(615, False), (620, True), (730, True), (735, False)]:
        session = NS(evaluated=True, evaluationTime=615, windowEnd=735)
        assert value('bool inWindow = ', s=session, time_close=minute) == active_window
        count += 1
    for last_exit, bar, fresh in [(None, 10, True), (10, 10, False), (10, 11, True)]:
        assert value('bool freshAfterExit = ', s=NS(lastExitBar=last_exit), bar_index=bar) == fresh
        count += 1
    cancel_gate = 'active.cycle ' + expression('if active.cycle ')
    for cycle, now, cancelled in [(1, 694, False), (1, 695, True), (2, 694, True)]:
        assert eval(cancel_gate, {'__builtins__': {}}, {'active':NS(cycle=1, expires=695), 'owner':NS(cycle=cycle), 'time_close':now}) == cancelled
        count += 1
    assert 'lookahead_on' not in SOURCE and 'request.security' not in SOURCE
    assert 'process_orders_on_close=false' in SOURCE and 'calc_on_order_fills=false' in SOURCE
    print(f'PASS {count} source-expression acceptance fixtures')


def read_chart():
    rows = list(csv.DictReader((ROOT / 'qa-five-sessions-chart-2026-10-07.csv').open(encoding='utf-8-sig')))
    for row in rows:
        row['t'] = dt.datetime.fromtimestamp(int(row['time']), TZ)
        row['tc'] = row['t'] + STEP
        for key in ('open','high','low','close'):
            row[key] = float(row[key])
    # The last realtime candle has no confirmed strategy execution yet.
    if not rows[-1]['Europe exact N-session reference'] and not rows[-1]['NY exact N-session reference']:
        rows.pop()
    return rows


def chart_audit(rows):
    summaries = {}
    references = {}
    bias_prices = {}
    for tag, start, end, evaluation, plot in [('EU',600,1110,615,'Europe'), ('NY',990,1380,975,'NY')]:
        by_date = defaultdict(list)
        for row in rows:
            minute = row['t'].hour * 60 + row['t'].minute
            if start <= minute and minute + 5 <= end:
                by_date[row['t'].date()].append(row)
        highs = {date: max(r['high'] for r in rs) for date,rs in by_date.items()}
        # Exclude a first session cut off by the chart's left history boundary.
        first = rows[0]['t']
        if first.hour*60 + first.minute > start:
            highs.pop(first.date(), None)
        dates = sorted(highs)
        checks = 0
        current_checks = 0
        for row in rows:
            tc = row['tc']
            minute = tc.hour*60 + tc.minute
            cycle_date = tc.date() if minute >= min(start,evaluation) else tc.date()-dt.timedelta(days=1)
            previous = [d for d in dates if d < cycle_date]
            if len(previous) >= 5:
                expected = highs[previous[-5]]
                plotted = row[plot+' exact N-session reference']
                assert plotted and math.isclose(float(plotted), expected, abs_tol=1e-7), (tag,tc,plotted,expected)
                references[(tag,cycle_date)] = expected
                checks += 1
            eligible = [r for r in by_date.get(cycle_date,[]) if r['tc'] <= tc]
            if eligible:
                expected_current = max(r['high'] for r in eligible)
                plotted_current = row[plot+' current high']
                assert plotted_current and math.isclose(float(plotted_current), expected_current,abs_tol=1e-7), (tag,tc,plotted_current,expected_current)
                current_checks += 1
            if minute == evaluation:
                bias_prices[(tag,tc.date())] = row['close']
        summaries[tag] = {'reference_checks':checks,'current_high_checks':current_checks,'observed_reference_sessions':len(highs)}
    print('PASS independently aggregated chart highs:', summaries)
    return references, bias_prices


def trade_audit(rows, references, bias_prices):
    exported = list(csv.DictReader((ROOT / 'qa-five-sessions-trades-2026-10-07.csv').open(encoding='utf-8-sig')))
    trades = defaultdict(dict)
    for row in exported:
        trades[int(row['Trade number'])]['entry' if row['Type'].startswith('Entry') else 'exit'] = row
    sessions = defaultdict(list)
    intervals = []
    matches = 0
    for number, trade in sorted(trades.items()):
        entry, exit = trade['entry'], trade['exit']
        tag, direction, rank, cycle = entry['Signal'].split('-')
        entered = dt.datetime.fromisoformat(entry['Date and time']).replace(tzinfo=TZ)
        exited = dt.datetime.fromisoformat(exit['Date and time']).replace(tzinfo=TZ)
        cycle_time = dt.datetime.fromtimestamp(int(cycle)/1000, TZ)
        assert entered.date() == cycle_time.date()
        evaluation = entered.replace(hour=10 if tag=='EU' else 16,minute=15,second=0)
        assert evaluation < entered <= evaluation+dt.timedelta(minutes=120)
        side = 1 if direction=='LONG' else -1
        reference = references[(tag,entered.date())]
        price = bias_prices[(tag,entered.date())]
        assert side == (1 if price > reference else -1 if price < reference else 0)
        assert exit['Signal'] in ('TP','SL')
        if exit['Signal']=='SL':
            assert abs(float(entry['Price EUR'])-float(exit['Price EUR'])) <= 40.1
        sessions[(tag,cycle)].append((int(rank),trade))
        intervals.append((entered,exited,number))
        # Find an actual completed, aligned FVG matching the recorded limit and
        # structural bracket. This audit does not assume a within-bar fill path.
        found = []
        for k in range(2,len(rows)):
            c1,c2,c3 = rows[k-2:k+1]
            if not evaluation < c3['tc'] <= entered or entered-c3['tc'] > dt.timedelta(minutes=60):
                continue
            lower,upper = (c1['high'],c3['low']) if side==1 else (c3['high'],c1['low'])
            width = upper-lower
            if width<=0 or width/((upper+lower)/2)*100 < .05:
                continue
            limit = lower+.3*width if side==1 else upper-.3*width
            stop = min(c['low'] for c in (c1,c2,c3)) if side==1 else max(c['high'] for c in (c1,c2,c3))
            risk = side*(limit-stop)
            target = limit+side*risk*1.5
            expected_exit = stop if exit['Signal']=='SL' else target
            if risk>0 and risk<=40 and abs(limit-float(entry['Price EUR']))<=.1000001 and abs(expected_exit-float(exit['Price EUR']))<=.1000001:
                found.append(c3['tc'])
        assert found, ('No matching FVG/SL/TP',number,entry,exit)
        matches += 1
    second = 0
    for key, cycle_trades in sessions.items():
        assert len(cycle_trades)<=2
        assert [rank for rank,_ in cycle_trades] == list(range(1,len(cycle_trades)+1))
        if len(cycle_trades)==2:
            first, next_trade = [trade for _,trade in cycle_trades]
            assert first['exit']['Signal']=='SL'
            assert next_trade['entry']['Date and time'] > first['exit']['Date and time']
            second += 1
    for previous,current in zip(sorted(intervals),sorted(intervals)[1:]):
        assert previous[1] <= current[0], ('Overlapping global positions',previous,current)
    print('PASS actual TradingView fills:', {'trades':len(trades),'matched_FVG_and_bracket':matches,'second_trades_after_SL':second,'same_bar_entry_exit':sum(t['entry']['Date and time']==t['exit']['Date and time'] for t in trades.values()),'exit_results':dict(Counter(t['exit']['Signal'] for t in trades.values()))})


if __name__ == '__main__':
    fixtures()
    chart = read_chart()
    refs,prices = chart_audit(chart)
    trade_audit(chart,refs,prices)
