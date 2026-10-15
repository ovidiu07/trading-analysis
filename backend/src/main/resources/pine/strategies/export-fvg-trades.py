#!/usr/bin/env python3
"""Extract one row per closed FVG trade from TradingView's chart-data CSV.

Export chart data with indicator data included. This does not read native
Strategy Report XLSX files or Deep Backtesting trades. Requires Python 3 only.
"""
import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

PREFIX = "FVG Trade: "


def extract(source: Path, destination: Path) -> int:
    with source.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        columns = {}
        for header in reader.fieldnames or []:
            if PREFIX in header:
                name = header.split(PREFIX, 1)[1]
                if name in columns:
                    raise ValueError(f"Duplicate FVG column {name!r}; export only one strategy instance")
                columns[name] = header
        required = {"Number", "Direction", "Created ms", "Lower", "Upper", "Actual Entry", "Bars To Fill", "Entry ms", "Exit ms", "Point Size", "Exit Reason"}
        missing = required - columns.keys()
        if missing:
            raise ValueError(f"Missing FVG Trade columns: {sorted(missing)}. Export chart data with this strategy's indicator data included.")
        rows = []
        seen = set()
        for raw in reader:
            number = raw[columns["Number"]].strip()
            if not number or number.lower() in {"nan", "na", "n/a"}:
                continue
            trade_number = int(float(number))
            if trade_number in seen:
                raise ValueError(f"Duplicate closed trade number {trade_number}")
            seen.add(trade_number)
            row = {name: raw[header] for name, header in columns.items()}
            row["Direction Name"] = {1: "LONG", -1: "SHORT"}.get(int(float(row["Direction"])), "UNKNOWN")
            row["Exit Name"] = {0: "OTHER", 1: "SL", 2: "TP", 3: "BE"}.get(int(float(row["Exit Reason"])), "UNKNOWN")
            row["Size Points / Pips"] = (float(row["Upper"]) - float(row["Lower"])) / float(row["Point Size"])
            if "Signed Age Limit" in row:
                signed_limit = int(float(row["Signed Age Limit"]))
                row["Age Filter Enabled"] = int(signed_limit > 0)
                row["Maximum FVG Age"] = abs(signed_limit)
                row["FVG Identifier Suffix"] = f"{int(float(row['Created ms']))}:{int(float(row['Direction']))}"
                row["FVG Identifier Scope"] = "Append to symbol:detection-timeframe; see native FVGAGEv1 id"
                # Fill Age is already measured on the source timeframe. Never
                # substitute Bars To Fill (chart bars) when the source is HTF.
                fill_age = row.get("Fill Age", "").strip()
                if signed_limit > 0 and fill_age and fill_age.lower() not in {"nan", "na", "n/a"} and float(fill_age) > abs(signed_limit):
                    raise ValueError(f"Trade {trade_number} filled beyond its FVG age limit")
            for name in ("Created", "Entry", "Exit"):
                row[name + " UTC"] = datetime.fromtimestamp(float(row[name + " ms"]) / 1000, timezone.utc).isoformat()
            rows.append(row)
    if not rows:
        raise ValueError("No closed FVG trades in the exported chart bars; no output written")
    with destination.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chart_csv", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if args.chart_csv.resolve() == args.output.resolve():
        parser.error("Input and output must be different files")
    try:
        count = extract(args.chart_csv, args.output)
    except (ValueError, KeyError, OSError) as error:
        parser.error(str(error))
    print(f"Extracted {count} closed chart-run FVG trades to {args.output}")
