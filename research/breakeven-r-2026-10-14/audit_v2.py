"""Reconcile the supplied V2 CSV and prepare/verify a corrected fixed-model export.

No application connection or database writes. Original Downloads files remain unchanged.
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter
from decimal import Decimal as D
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path('/Users/ovidiu/Downloads/backtesting-FS-aut-RR-1-3-BE-90-V2-entry-2024-10-08-2026-10-13')
OUT = ROOT / 'output/breakeven-r-2026-10-14'
INPUT = Path(__file__).with_name('source.json')


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def main():
    rows = read_csv(SOURCE / 'trades.csv')
    assert len(rows) == 523
    reasons = Counter(row['Exit signal'].split(' |')[0] for row in rows)
    assert reasons == {'TP': 138, 'SL': 365, 'BE': 20}, reasons
    assert sum(D(row['Realized R']) for row in rows) == 109
    assert sum(D(row['Net PnL']) for row in rows) == D('6515.36')
    metadata = json.loads((SOURCE / 'workspace.json').read_text())
    corrected = [dict(row) for row in rows]
    changes = []
    for row in corrected:
        if row['Exit signal'].split(' |')[0] != 'BE':
            continue
        assert row['Result'] == 'WIN' and D(row['Realized R']) == 3
        assert D(row['Planned R:R']) == D(row['FVG configured R:R']) == 3
        assert 'BE=90/30' in row['Entry signal']
        assert D(row['FVG BE protected profit (% of entry-to-TP)']) == 30
        value = D(row['Planned R:R']) * D(row['FVG BE protected profit (% of entry-to-TP)']) / 100
        row['Realized R'] = str(value)
        changes.append({'tradeId': row['Trade ID'], 'fromR': 3, 'toR': float(value),
                        'entry': row['Entry date and time'], 'direction': row['Direction'],
                        'entryPrice': row['Entry price'], 'exitPrice': row['Exit price'],
                        'netPnlUSD': row['Net PnL'], 'model': 'FIXED_OUTCOME_RR_TIMES_LOCK_PERCENT'})
    assert len(changes) == 20
    assert sum(D(row['Realized R']) for row in corrected) == 67
    if len(sys.argv) > 1 and sys.argv[1] == 'verify':
        saved = read_csv(OUT / 'trades.csv')
        # Complete per-field equality: only the 20 intended R cells may differ.
        assert saved == corrected, 'A source field other than the intended R cells changed'
        overview = read_csv(OUT / 'overview.csv')
        assert D(next(row for row in overview if row['Basis'] == 'R')['Net result']) == 67
        assert D(next(row for row in overview if row['Basis'] == 'USD')['Net result']) == D('6515.36')
        # Every cash metric remains identical across overview, edge, period and lens reports.
        for name in ('overview.csv', 'edge-analysis.csv', 'periods.csv', 'saved-edge-lenses.csv'):
            before = [row for row in read_csv(SOURCE / name) if row['Basis'] != 'R']
            after = [row for row in read_csv(OUT / name) if row['Basis'] != 'R']
            assert before == after, f'Cash metrics changed in {name}'
        print('PASS: 523 rows; exactly 20 R corrections; all other trade cells and all cash analytics preserved.')
        return
    # Use the production exporter field mapping and API types to reconstruct its input losslessly.
    export_code = (ROOT / 'frontend/src/features/backtesting/export.ts').read_text()
    fields_block = export_code.split('const tradeFields = {', 1)[1].split('} satisfies', 1)[0]
    fields = dict(re.findall(r"(\w+): '([^']+)'", fields_block))
    api = (ROOT / 'frontend/src/api/backtesting.ts').read_text().split('export type BacktestingTrade = {', 1)[1].split('\n}', 1)[0]
    numbers = set(re.findall(r'^  (\w+)\??: number', api, re.M))
    booleans = set(re.findall(r'^  (\w+)\??: boolean', api, re.M))
    trades = []
    for row in corrected:
        trade = {}
        for key, label in fields.items():
            value = row[label]
            if key == 'tags':
                value = json.loads(value)
            elif value == '':
                value = None
            elif key in numbers:
                value = float(value)
            elif key in booleans:
                assert value in ('true', 'false')
                value = value == 'true'
            trade[key] = value
        trades.append(trade)
    assert not read_csv(SOURCE / 'saved-edge-lenses.csv') and not read_csv(SOURCE / 'screenshots.csv')
    INPUT.write_text(json.dumps({'trades': trades, 'metadata': metadata, 'changes': changes}))
    OUT.mkdir(parents=True, exist_ok=True)
    audit = {'source': str(SOURCE), 'sourceTradesSha256': hashlib.sha256((SOURCE / 'trades.csv').read_bytes()).hexdigest(),
             'trades': 523, 'exitCounts': dict(reasons), 'changedTrades': 20,
             'oldR': 109, 'correctedModelR': 67, 'reductionR': 42,
             'oldExpectancyR': str(D(109) / 523), 'correctedModelExpectancyR': str(D(67) / 523),
             'netPnlUSD': '6515.36', 'measuredFillPriceR': 'UNAVAILABLE_ORIGINAL_STOP_AND_TARGET_NOT_EXPORTED',
             'database': 'NOT_MODIFIED', 'changes': changes}
    (OUT / 'be-r-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print('Prepared 523 production-export inputs and 20 source-verified BE model corrections.')


if __name__ == '__main__':
    main()
