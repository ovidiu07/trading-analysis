#!/usr/bin/env python3
"""Generate Pine assertions against production age/FVG/BE/loss helpers.

Local generation is not runtime execution. Run the output in TradingView.
"""
from pathlib import Path
import argparse
import importlib.util
import sys
sys.dont_write_bytecode = True
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pine-output', type=Path, required=True)
args = parser.parse_args()
p=Path(__file__).parent
spec=importlib.util.spec_from_file_location('report_qa',p/'qa-five-sessions-fvg-report.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
s=(p/'devtrader-five-sessions-fvg-windows.pine').read_text()
base,count,wiring=m.build_harness(s)
base=base.split('var table result =',1)[0]
lines=[base,'if barstate.isfirst']
def check(c,d):
 global count
 count+=1;lines.append(f'    passed += f_assert({c}, "{d}")')
for maximum in (2,3,4,6):
 for age in range(0,maximum+3):
  check(f'f_fvgAge(100, {100+age}) == {age}',f'confirmation age {age} maximum {maximum}')
  check(f'f_fvgCanRest(false, {age}, {maximum})',f'OFF ignores age {age} maximum {maximum}')
  check(f'f_fvgCanRest(true, {age}, {maximum}) == {str(age<maximum).lower()}',f'can rest next bar age {age} max {maximum}')
  check(f'f_fvgAgeExpired(true, {age}, {maximum}) == {str(age>=maximum).lower()}',f'cancel at last eligible close age {age} max {maximum}')
check('na(f_fvgAge(101, 100)) and na(f_fvgAge(na, 100))','unknown and future confirmation unavailable')
check('f_fvgCanRest(false, na, 3) and not f_fvgAgeExpired(false, na, 3)','OFF does not add missing-age restriction')
check('not f_fvgCanRest(true, na, 3) and f_fvgAgeExpired(true, na, 3)','ON refuses unknown source age')
check('f_fvgCompletedSourceBar(100, 900000, 900000) == 100','HTF exact close confirms source index')
check('f_fvgCompletedSourceBar(101, 1800000, 1200000) == 100','realtime developing source is not completed')
check('f_fvgCompletedSourceBar(100, 900000, 1200000) == 100','historical last confirmed source remains completed')
check('f_fvgContainingSourceBar(100, 900000, 900000) == 101','first HTF child has following source index')
check('f_fvgContainingSourceBar(101, 1800000, 900000) == 101','realtime and historical containing source agree')
check('f_fvgContainingSourceBar(101, 1800000, 1500000) == 101','HTF closing child retains correct containing bar')
check('f_fvgAge(100, f_fvgContainingSourceBar(100, 900000, 259200000)) == 1','weekend wall-clock jump counts one source bar')
for bias in (1,-1):
 name='bull' if bias==1 else 'bear'
 lines.append(f'    TradePlan {name} = TradePlan.new(0, 0, 0, 9999999, {bias}, "{name}", 105, {95 if bias==1 else 115}, 130, 110, 100, 0, 900000, 10, confirmationSourceBar=100, submissionAge=0, ageFilterEnabled=true, maximumAge=3)')
 lines.append(f'    f_captureFvgFill({name}, 105, 19, 3600000, 103)')
 check(f'{name}.fillAge == 3 and {name}.submissionAge == 0',f'{name} actual fill age differs from order age')
 lines.append(f'    f_captureFvgFill({name}, 106, 20, 3900000, 104)')
 check(f'{name}.fillAge == 3 and {name}.entryBar == 19',f'{name} fill metadata is immutable')
check('bull.confirmationSourceBar == 100 and bear.confirmationSourceBar == 100','a later FVG cannot mutate selected confirmation')
lines+=['var table result = table.new(position.bottom_left, 1, 1)','if barstate.islastconfirmedhistory or barstate.islast',f'    table.cell(result, 0, 0, "PASS " + str.tostring(passed) + " / {count} AGE + FVG + BE + LOSS assertions", text_color=color.white, bgcolor=color.green)']
args.pine_output.write_text('\n'.join(lines)+'\n')
assert s.count('\nplot(') == 64
assert 'enableFvgAgeFilter = input.bool(false,' in s
assert 'options=[2, 3, 4, 6]' in s
assert s.count('confirmationSourceBar=completedFvgSourceBar') == 2
assert 'confirmationSourceBar=candidate.confirmationSourceBar' in s
assert s.index('f_captureFvgFill(activePlan, strategy.closedtrades.entry_price(i)') < s.index('bool ageExpired =')
assert s.index('f_captureFvgFill(activePlan, strategy.position_avg_price') < s.index('bool ageExpired =')
assert 'if not na(activePlan) and not activePlan.filled\n' in s
assert 'candidateAge, maximumFvgAgeBars)' in s
assert 'lookahead=barmerge.lookahead_off' in s and 'lookahead_on' not in s
assert 'FVG_AGE_V1,' in s and 'FVGAGEv1 id=' in s
print(f'PASS {m.check_wiring(s) + wiring + 11} source integration checks')
print(f'Generated {count} Pine assertions in {args.pine_output}; runtime execution still required')
