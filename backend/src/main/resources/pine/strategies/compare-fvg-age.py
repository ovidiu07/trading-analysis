#!/usr/bin/env python3
"""Extract FVG_AGE_V1 Pine Logs and compare separately executed A-E runs.

No backtest is performed by this tool. Inputs must cover the same chart dataset
and use identical non-age inputs/properties. Empty/truncated logs fail closed.
"""
import argparse
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

FIELDS = ('schema trade_number fvg_id direction timeframe confirmation_ms '
          'confirmation_source_bar submission_age fill_age size_points size_percent '
          'upper lower maximum_age filter_enabled session_index session_start_ms '
          'submitted_ms entry_ms exit_ms price_r exit_reason reported_profit '
          'initial_risk_account realized_r').split()
INTEGER_FIELDS = set(('trade_number direction confirmation_ms confirmation_source_bar '
                     'submission_age fill_age maximum_age filter_enabled session_index '
                     'session_start_ms submitted_ms entry_ms exit_ms').split())
TEXT_FIELDS = {'schema', 'fvg_id', 'timeframe', 'exit_reason'}
MODES = {'A': (0, 3), 'B': (1, 2), 'C': (1, 3), 'D': (1, 4), 'E': (1, 6)}


def read_logs(path, mode):
    rows = []
    seen = set()
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if 'FVG_AGE_V1,' not in line:
            continue
        # Accept plain copied Pine Logs and CSV exports with a quoted Message
        # cell. Parse the outer CSV first when it contains the entire record.
        cells = next(csv.reader([line]))
        payload = next((cell for cell in cells if 'FVG_AGE_V1,' in cell), line)
        values = next(csv.reader([payload[payload.index('FVG_AGE_V1,'):]]))
        if len(values) != len(FIELDS):
            raise ValueError(f'{path}: expected {len(FIELDS)} fields, got {len(values)}')
        row = dict(zip(FIELDS, values))
        for key in set(FIELDS) - TEXT_FIELDS:
            raw = row[key].strip()
            value = None if raw.lower() in {'', 'na', 'nan', 'n/a'} else float(raw)
            if value is not None and not math.isfinite(value):
                raise ValueError(f'{path}: non-finite {key}')
            if value is not None and key in INTEGER_FIELDS:
                if value != int(value):
                    raise ValueError(f'{path}: non-integer {key}')
                value = int(value)
            row[key] = value
        number = row['trade_number']
        if number is None or number in seen:
            raise ValueError(f'{path}: missing/duplicate trade number {number}')
        seen.add(number)
        enabled, maximum = MODES[mode]
        if row['filter_enabled'] != enabled or (enabled and row['maximum_age'] != maximum):
            raise ValueError(f'{path}: trade {number} is not mode {mode}')
        if row['fill_age'] is None or row['confirmation_source_bar'] is None:
            raise ValueError(f'{path}: trade {number} has unavailable source age')
        if enabled and not 1 <= row['fill_age'] <= maximum:
            raise ValueError(f'{path}: trade {number} filled outside permitted source bars')
        if not row['confirmation_ms'] <= row['submitted_ms'] <= row['entry_ms'] <= row['exit_ms']:
            raise ValueError(f'{path}: trade {number} has inconsistent timestamps')
        if row['initial_risk_account'] is not None and row['initial_risk_account'] > 0:
            expected_r = row['reported_profit'] / row['initial_risk_account']
            if row['realized_r'] is None or not math.isclose(expected_r, row['realized_r'], rel_tol=0.0001, abs_tol=0.0001):
                raise ValueError(f'{path}: trade {number} has inconsistent realized R')
        for key in ('confirmation', 'submitted', 'entry', 'exit'):
            row[key + '_utc'] = datetime.fromtimestamp(row[key + '_ms'] / 1000, timezone.utc).isoformat()
        rows.append(row)
    if not rows:
        raise ValueError(f'{path}: no FVG_AGE_V1 records; empty is not a zero-trade run')
    if seen != set(range(1, max(seen) + 1)):
        raise ValueError(f'{path}: incomplete/non-contiguous chart trade coverage')
    return sorted(rows, key=lambda row: (row['exit_ms'], row['trade_number']))


def validate_native(rows, path, native_timezone):
    """Cross-check the log's tail/count and trade association against native CSV."""
    with path.open(newline='', encoding='utf-8-sig') as stream:
        native = list(csv.DictReader(stream))
    if len(native) != 2 * len(rows):
        raise ValueError(f'{path}: native/log count mismatch; possible truncated log tail')
    grouped = {}
    for row in native:
        grouped.setdefault(int(row['Trade number']), []).append(row)
    if set(grouped) != {row['trade_number'] for row in rows}:
        raise ValueError(f'{path}: native/log trade numbers differ')
    tz = ZoneInfo(native_timezone)
    for trade in rows:
        pair = grouped[trade['trade_number']]
        entries = [row for row in pair if row['Type'].startswith('Entry')]
        exits = [row for row in pair if row['Type'].startswith('Exit')]
        if len(entries) != 1 or len(exits) != 1:
            raise ValueError(f'{path}: expected one entry/exit per trade')
        entry, exit = entries[0], exits[0]
        if trade['fvg_id'] not in entry['Signal'] or ('long' in entry['Type']) != (trade['direction'] == 1):
            raise ValueError(f'{path}: FVG/direction association mismatch')
        for key, record in (('entry_ms', entry), ('exit_ms', exit)):
            stamp = datetime.fromtimestamp(trade[key] / 1000, tz).strftime('%Y-%m-%d %H:%M')
            if stamp != record['Date and time']:
                raise ValueError(f'{path}: {key} does not match native timestamp')
        pnl_key = next((key for key in exit if key.startswith('Net PnL ')), None)
        if pnl_key is None or not math.isclose(float(exit[pnl_key]), trade['reported_profit'], abs_tol=.0050001):
            raise ValueError(f'{path}: reported P/L does not match native net P/L')
    return len(rows)


def metrics(rows):
    known = [row for row in rows if row['realized_r'] is not None]
    gross_profit = sum(max(0, row['reported_profit']) for row in rows)
    gross_loss = -sum(min(0, row['reported_profit']) for row in rows)
    result = {'total_trades': len(rows), 'r_coverage': f'{len(known)}/{len(rows)}',
              'protected_stop_exits': sum(row['exit_reason'] == 'BE' for row in rows),
              'profit_factor_money': gross_profit / gross_loss if gross_loss else None,
              'reported_total_profit': sum(row['reported_profit'] for row in rows)}
    if len(known) != len(rows) or not rows:
        result.update({key: None for key in ('winning_trades', 'losing_trades', 'break_even_trades',
                       'win_rate', 'total_realized_r', 'expectancy_r', 'profit_factor_r',
                       'maximum_drawdown_r', 'maximum_consecutive_losses',
                       'longest_drawdown_hours_observed', 'unrecovered_drawdown')})
        return result
    returns = [row['realized_r'] for row in rows]
    positive = sum(r for r in returns if r > 1e-9)
    negative = -sum(r for r in returns if r < -1e-9)
    equity = peak = max_dd = 0.0
    streak = max_streak = 0
    peak_time = rows[0]['entry_ms']
    longest_ms = 0
    for row, r in zip(rows, returns):
        was_underwater = equity < peak - 1e-9
        equity += r
        streak = streak + 1 if r < -1e-9 else 0
        max_streak = max(max_streak, streak)
        max_dd = max(max_dd, peak - equity)
        if equity < peak - 1e-9:
            longest_ms = max(longest_ms, row['exit_ms'] - peak_time)
        else:
            if was_underwater:
                longest_ms = max(longest_ms, row['exit_ms'] - peak_time)
            peak_time = row['exit_ms']
            peak = max(peak, equity)
    wins = sum(r > 1e-9 for r in returns)
    result.update(winning_trades=wins, losing_trades=sum(r < -1e-9 for r in returns),
                  break_even_trades=sum(abs(r) <= 1e-9 for r in returns),
                  win_rate=wins / len(rows), total_realized_r=sum(returns),
                  expectancy_r=sum(returns) / len(rows),
                  profit_factor_r=positive / negative if negative else None,
                  profit_factor_note='no losing R; ratio undefined' if not negative else '',
                  maximum_drawdown_r=max_dd, maximum_consecutive_losses=max_streak,
                  longest_drawdown_hours_observed=longest_ms / 3600000,
                  unrecovered_drawdown=equity < peak - 1e-9)
    return result


def compare(runs, annual_timezone):
    tz = ZoneInfo(annual_timezone)
    output = {'classification': 'exploratory; no automatic winner selection',
              'r_basis': 'reported account P/L / actual initial stop risk converted at fill observation',
              'drawdown_basis': 'closed-trade R equity; duration observed through last exit, including unrecovered periods',
              'annual_attribution': f'exit year in {annual_timezone}', 'modes': {}}
    for mode, rows in runs.items():
        sessions = sorted({row['session_index'] for row in rows})
        years = sorted({datetime.fromtimestamp(row['exit_ms']/1000, tz).year for row in rows})
        output['modes'][mode] = {
            'overall': metrics(rows),
            'sessions': {str(session): metrics([row for row in rows if row['session_index'] == session]) for session in sessions},
            'years': {str(year): metrics([row for row in rows if datetime.fromtimestamp(row['exit_ms']/1000, tz).year == year]) for year in years},
            'first_entry_utc': rows[0]['entry_utc'], 'last_exit_utc': rows[-1]['exit_utc']}
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for mode in MODES:
        parser.add_argument('--' + mode, type=Path, required=True, help=f'complete mode {mode} Pine Logs text')
        parser.add_argument('--native-' + mode, type=Path, help=f'optional native Trades CSV for mode {mode}; validates log coverage/association')
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--annual-timezone', default='Europe/Bucharest')
    parser.add_argument('--native-timezone', default='Europe/Bucharest', help='chart/report timezone used by native CSV timestamps')
    args = parser.parse_args()
    try:
        runs = {mode: read_logs(getattr(args, mode), mode) for mode in MODES}
        result = compare(runs, args.annual_timezone)
        result['native_cross_checks'] = {
            mode: validate_native(rows, getattr(args, 'native_' + mode), args.native_timezone)
            for mode, rows in runs.items() if getattr(args, 'native_' + mode) is not None}
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for mode, rows in runs.items():
            with (args.output_dir / f'{mode}-trades.csv').open('w', newline='', encoding='utf-8') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader(); writer.writerows(rows)
        (args.output_dir / 'comparison.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    except (ValueError, KeyError, OSError, TypeError) as error:
        parser.error(str(error))
    print(f'Compared five supplied chart runs; confirm identical dataset, settings, costs and count against native reports: {args.output_dir}')


if __name__ == '__main__':
    main()
