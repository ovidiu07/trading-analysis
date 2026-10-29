"""Rebuild standalone TradingView QA scripts from the actual delivered sources."""
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PUBLISHED = ROOT / 'backend/src/main/resources/pine/published'


def replace_once(source: str, before: str, after: str) -> str:
    if source.count(before) != 1:
        raise ValueError(f'Expected exactly one QA substitution: {before}')
    return source.replace(before, after, 1)


main = (PUBLISHED / 'zones-of-interest.pine').read_text()
main_qa = replace_once(main, '"Devtrader Zones of Interest", "Devtrader ZOI"',
                       '"Devtrader ZOI QA", "ZOI QA"')
main_qa += (HERE / 'lifecycle-assertions.inc').read_text()
(HERE / 'zones-lifecycle-qa.pine').write_text(main_qa)

footprint = (PUBLISHED / 'zones-of-interest-footprint.pine').read_text()
for before, after in (
    ('"Devtrader ZOI | Footprint POC companion", "ZOI Footprint"',
     '"ZOI Footprint Data QA", "Footprint QA"'),
    ('input.int(100, "Ticks per footprint row"', 'input.int(1000, "Ticks per footprint row"'),
    ('input.float(1.5, "Minimum footprint volume / baseline"',
     'input.float(0.5, "Minimum footprint volume / baseline"'),
    ('input.float(15.0, "Minimum volume in POC row / %"',
     'input.float(1.0, "Minimum volume in POC row / %"'),
):
    footprint = replace_once(footprint, before, after)
footprint += '''
// Relaxed input defaults above exercise the native-data drawing branch only.
// They are not recommended or optimised trading parameters.
var int qaCreated = 0
qaCreated += barstate.isconfirmed and newPOC ? 1 : 0
var table qa = table.new(position.top_right, 1, 1)
if barstate.islast
    table.cell(qa, 0, 0, "Footprint data QA: " + str.tostring(qaCreated) + " rows created | " + str.tostring(nodes.size()) + " still untouched", bgcolor = color.green, text_color = color.white)
if barstate.islastconfirmedhistory and availableBars > averageLength and qaCreated == 0
    runtime.error("Footprint data QA: no POC creation branch exercised")
'''
(HERE / 'footprint-data-qa.pine').write_text(footprint)
print('Rebuilt Pine QA artifacts from current delivered sources.')
print('Assertions:', (HERE / 'lifecycle-assertions.inc').read_text().count('passed += f_assert('))
