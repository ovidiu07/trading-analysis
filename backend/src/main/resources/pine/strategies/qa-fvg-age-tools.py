#!/usr/bin/env python3
"""Focused regression checks for the age exports and exploratory comparison.

Synthetic analytical fixtures; this does not simulate or execute Pine orders.
"""
import importlib.util
import math
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).parent
ROOT = HERE.parents[5]


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


compare = module('age_compare', 'compare-fvg-age.py')
export = module('fvg_export', 'export-fvg-trades.py')


def trade(number, r, exit_ms, reason='SL'):
    return {'trade_number': number, 'realized_r': r, 'reported_profit': r * 100 if r is not None else 0,
            'entry_ms': exit_ms - 3600000, 'exit_ms': exit_ms, 'exit_reason': reason}


def record(number=1, enabled=1, maximum=3, fill_age=3):
    data = dict(zip(compare.FIELDS, ['FVG_AGE_V1', number, 'PEPPERSTONE:GER40F:5:100000:1', 1, '5',
        100000, 100, 0, fill_age, 10, 0.04, 110, 100, maximum, enabled, 2, 0,
        100000, 1000000, 2000000, 0.9, 'BE', 88, 100, 0.88]))
    return ','.join(str(data[key]) for key in compare.FIELDS)


class Analytics(unittest.TestCase):
    def test_realized_protected_profit_is_not_full_target(self):
        result = compare.metrics([trade(1, -1, 3600000), trade(2, .88, 7200000, 'BE'), trade(3, 0, 10800000, 'BE')])
        self.assertAlmostEqual(result['total_realized_r'], -.12)
        self.assertAlmostEqual(result['expectancy_r'], -.04)
        self.assertAlmostEqual(result['profit_factor_r'], .88)
        self.assertEqual((result['winning_trades'], result['losing_trades'], result['break_even_trades']), (1, 1, 1))
        self.assertEqual(result['protected_stop_exits'], 2)

    def test_drawdown_and_recovery_duration(self):
        rows = [trade(1, 1, 3600000), trade(2, -1, 7200000), trade(3, -1, 10800000), trade(4, 2, 14400000)]
        result = compare.metrics(rows)
        self.assertEqual(result['maximum_drawdown_r'], 2)
        self.assertEqual(result['maximum_consecutive_losses'], 2)
        self.assertEqual(result['longest_drawdown_hours_observed'], 3)
        self.assertFalse(result['unrecovered_drawdown'])

    def test_unrecovered_drawdown_is_marked(self):
        result = compare.metrics([trade(1, -1, 3600000), trade(2, -.1, 7200000)])
        self.assertTrue(result['unrecovered_drawdown'])
        self.assertEqual(result['longest_drawdown_hours_observed'], 2)

    def test_flat_peak_uses_latest_high_water_mark(self):
        rows = [trade(1, 1, 3600000), trade(2, 0, 7200000, 'BE'), trade(3, -1, 10800000), trade(4, 1, 14400000)]
        self.assertEqual(compare.metrics(rows)['longest_drawdown_hours_observed'], 2)

    def test_quoted_downloaded_log_csv(self):
        self.assertEqual(self.parse('Date,Message\n2026-10-14,"' + record() + '"')[0]['trade_number'], 1)

    def test_missing_r_does_not_become_zero(self):
        result = compare.metrics([trade(1, None, 3600000)])
        self.assertEqual(result['r_coverage'], '0/1')
        self.assertIsNone(result['total_realized_r'])

    def test_no_losses_does_not_emit_infinite_json(self):
        self.assertIsNone(compare.metrics([trade(1, 1, 3600000)])['profit_factor_r'])

    def test_actual_protected_stop_loss_counts_as_loss(self):
        result = compare.metrics([trade(1, -.02, 3600000, 'BE')])
        self.assertEqual(result['losing_trades'], 1)
        self.assertEqual(result['protected_stop_exits'], 1)

    def parse(self, content, mode='C'):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'logs.txt'
            path.write_text(content)
            return compare.read_logs(path, mode)

    def test_complete_versioned_record(self):
        row = self.parse('[2026-10-14 00:00] ' + record())[0]
        self.assertEqual(row['fill_age'], 3)
        self.assertEqual(row['submission_age'], 0)
        self.assertEqual(row['realized_r'], .88)

    def test_empty_is_not_zero_trade_success(self):
        with self.assertRaisesRegex(ValueError, 'no FVG_AGE'):
            self.parse('other logs')

    def test_missing_early_trades_fails(self):
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.parse(record(number=2))

    def test_duplicate_fails(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.parse(record() + '\n' + record())

    def test_prohibited_fill_fails(self):
        with self.assertRaisesRegex(ValueError, 'outside permitted'):
            self.parse(record(fill_age=4))

    def test_wrong_mode_fails(self):
        with self.assertRaisesRegex(ValueError, 'not mode'):
            self.parse(record(maximum=2))

    def test_off_does_not_apply_age_restriction(self):
        self.assertEqual(self.parse(record(enabled=0, fill_age=100), 'A')[0]['fill_age'], 100)

    def test_existing_chart_export_remains_supported(self):
        path = ROOT / 'research/fvg-strategy-2026-10-14/profit-lock-chart-extract.csv'
        with tempfile.TemporaryDirectory() as temporary:
            self.assertEqual(export.extract(path, Path(temporary) / 'trades.csv'), 1)

    def test_real_native_exports_match_complete_logs(self):
        folder = ROOT / 'research/fvg-age-filter-2026-10-14'
        names = {'A': 'A-off', 'B': 'B-age2', 'C': 'C-age3', 'D': 'D-age4', 'E': 'E-age6'}
        for mode, name in names.items():
            rows = compare.read_logs(folder / f'{mode}-pine-logs.csv', mode)
            self.assertEqual(compare.validate_native(rows, folder / f'{name}-native-trades.csv', 'Europe/Bucharest'), len(rows))

    def test_truncated_tail_rejected_against_native_report(self):
        folder = ROOT / 'research/fvg-age-filter-2026-10-14'
        rows = compare.read_logs(folder / 'A-pine-logs.csv', 'A')[:-1]
        with self.assertRaisesRegex(ValueError, 'truncated log tail'):
            compare.validate_native(rows, folder / 'A-off-native-trades.csv', 'Europe/Bucharest')

    def test_original_mechanics_unchanged(self):
        import re
        old = (ROOT / 'research/fvg-age-filter-2026-10-14/baseline-before-age-filter.pine').read_text()
        new = (HERE / 'devtrader-five-sessions-fvg-windows.pine').read_text()
        for name in ('f_fvgThreshold', 'f_fvgDetectPayload', 'f_strategyFvgPayload', 'f_fvgEntry', 'f_entryPrice',
                     'f_stopPrice', 'f_stopValid', 'f_breakevenTrigger', 'f_breakevenObservation',
                     'f_breakevenLock', 'f_armBreakeven', 'f_recordLossResult', 'f_fiveProcess'):
            pattern = rf'^{name}\([^\n]*\n(?:[ \t]+[^\n]*\n|\n)*'
            before = re.search(pattern, old, re.MULTILINE)
            after = re.search(pattern, new, re.MULTILINE)
            self.assertIsNotNone(before, name)
            self.assertIsNotNone(after, name)
            self.assertEqual(before.group(), after.group(), name)
        self.assertEqual(old.split('// --- General Settings ---')[0], new.split('// --- General Settings ---')[0])


if __name__ == '__main__':
    unittest.main(verbosity=2)
