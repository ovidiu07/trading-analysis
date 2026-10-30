#!/usr/bin/env python3
"""Deterministic checks for the ICT lifecycle helper extracted from production.

The small expression adapter executes this helper's scalar subset locally; it is
NOT a Pine compiler or a TradingView feed simulator. --write-harness also emits
a Pine indicator using the exact helper for authoritative TradingView execution.
"""
from __future__ import annotations

import argparse
import math
import re
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

SOURCE = Path(__file__).with_name("devtrader-volume-profile.pine")
TEXT = SOURCE.read_text()
HELPER = TEXT.split("update_ict_candidate(", 1)[1].split(
    "// ----------------------------------------------------------------------------\n// Session state", 1
)[0].strip()
HELPER = "update_ict_candidate(" + HELPER


class Expression:
    """Translate only the scalar expression grammar used by the shared helper."""
    TOKEN = re.compile(r'\s*("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|[A-Za-z_]\w*|>=|<=|==|!=|[().,?:+*/<>-])')
    PRECEDENCE = {"or": 1, "and": 2, "==": 3, "!=": 3, "<": 3,
                  ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5}

    def __init__(self, text):
        self.tokens = []
        pos = 0
        while pos < len(text):
            match = self.TOKEN.match(text, pos)
            if not match:
                raise ValueError(f"Unsupported Pine expression: {text[pos:]!r}")
            self.tokens.append(match[1])
            pos = match.end()
        self.i = 0

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self, expected=None):
        token = self.peek()
        if token is None or (expected is not None and token != expected):
            raise ValueError(f"Expected {expected}, got {token}")
        self.i += 1
        return token

    def parse(self, minimum=0):
        token = self.take()
        if token in ("not", "-", "+"):
            left = f"({token} {self.parse(6)})"
        elif token == "(":
            left = "(" + self.parse() + ")"
            self.take(")")
        else:
            left = {"true": "True", "false": "False"}.get(token, token)
            if token == "na":
                left = "is_na" if self.peek() == "(" else "None"
        while True:
            token = self.peek()
            if token == ".":
                self.take()
                left += "." + self.take()
            elif token == "(":
                self.take()
                args = []
                while self.peek() != ")":
                    args.append(self.parse())
                    if self.peek() != ",":
                        break
                    self.take()
                self.take(")")
                left += "(" + ", ".join(args) + ")"
            elif token == "?" and minimum == 0:
                self.take()
                yes = self.parse()
                self.take(":")
                no = self.parse()
                left = f"({yes} if {left} else {no})"
            elif token in self.PRECEDENCE and self.PRECEDENCE[token] >= minimum:
                op = self.take()
                right = self.parse(self.PRECEDENCE[op] + 1)
                left = f"({left} {op} {right})"
            else:
                return left

    @classmethod
    def translate(cls, text):
        parser = cls(text)
        result = parser.parse()
        if parser.peek() is not None:
            raise ValueError(f"Unconsumed token {parser.peek()}")
        return result


def load_function(helper, globals_=None):
    signature, body = helper.split(" =>\n", 1)
    signature = re.sub(r"map<int, float>", "map", signature)
    names = []
    for arg in signature.split("(", 1)[1][:-1].split(","):
        declaration, separator, default = arg.partition("=")
        names.append(declaration.strip().split()[-1] + ("=" + Expression.translate(default.strip()) if separator else ""))
    lines = ["def adapted(" + ", ".join(names) + "):"]
    body_lines = [line for line in body.splitlines() if line.strip() and not line.strip().startswith("//")]
    for index, line in enumerate(body_lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        indent = line[:len(line) - len(line.lstrip())]
        if stripped.startswith("for "):
            match = re.fullmatch(r"for (\w+) = (.+) to (.+)", stripped)
            if match:
                out = f"for {match[1]} in range({Expression.translate(match[2])}, {Expression.translate(match[3])} + 1):"
            else:
                match = re.fullmatch(r"for (\w+) in (.+)", stripped)
                if not match:
                    raise ValueError(f"Unsupported loop: {stripped}")
                out = f"for {match[1]} in {Expression.translate(match[2])}:"
        elif stripped.startswith("while "):
            out = "while " + Expression.translate(stripped[6:]) + ":"
        elif stripped.startswith("else if "):
            out = "elif " + Expression.translate(stripped[8:]) + ":"
        elif stripped.startswith("if "):
            out = "if " + Expression.translate(stripped[3:]) + ":"
        elif stripped == "else":
            out = "else:"
        elif " := " in stripped or " = " in stripped:
            left, right = re.split(r"\s+(?::=|=)\s+", stripped, maxsplit=1)
            left = re.sub(r"^(bool|int|float|string|LiquidityLevel)\s+", "", left)
            out = left + " = " + Expression.translate(right)
        else:
            out = ("return " if index == len(body_lines) - 1 else "") + Expression.translate(stripped)
        lines.append(indent + out)
    namespace = {"is_na": lambda x: x is None or isinstance(x, float) and math.isnan(x),
                 "nz": lambda x: 0 if x is None else x,
                 "math": SimpleNamespace(max=max, min=min, floor=math.floor, ceil=math.ceil, abs=abs, avg=lambda a, b: (a + b) / 2)}
    namespace.update(globals_ or {})
    exec("\n".join(lines), namespace)
    return namespace["adapted"]


LIFECYCLE = load_function(HELPER)
PROFILE_ADD = load_function(TEXT[TEXT.index("profile_add(\n"):TEXT.index("profile_add_range(")].strip(), {"MAX_PROFILE_BINS": 2500})
PROFILE_RANGE = load_function(TEXT[TEXT.index("profile_add_range("):TEXT.index("profile_stats(")].strip(), {"profile_add": PROFILE_ADD})


def one_helper(name):
    return TEXT[TEXT.index(name + "("):].split("\n\n", 1)[0]


OBSERVED_START = load_function(one_helper("observed_session_start"))
MISSING_FLOW = load_function(one_helper("traded_flow_missing"))
ASSESSMENT = load_function(one_helper("assessment_status"))


LIQUIDITY_EVENT = load_function(one_helper("liquidity_event"))
EQUAL_POOL = load_function(one_helper("equal_pool_valid"))
LOCAL_LOCATION = load_function(one_helper("local_location_ok"))
LIQUIDITY_PRIORITY = load_function(one_helper("liquidity_priority"))
NEAREST_LIQUIDITY = load_function(one_helper("nearest_liquidity"), {"liquidity_priority": LIQUIDITY_PRIORITY})


def level(price=100., side=-1, **changes):
    values = dict(price=price, side=side, name="EQL", kind="EQ", born=10,
                  expires=10000, expiresBar=None, consumed=False)
    values.update(changes)
    return SimpleNamespace(**values)


class PineArray(list):
    def push(self, value):
        self.append(value)

    def shift(self):
        return self.pop(0)

    def size(self):
        return len(self)


ADD_LIQUIDITY = load_function(one_helper("add_liquidity"), {
    "LiquidityLevel": SimpleNamespace(new=lambda price, side, name, kind, born, expires:
        level(price, side, name=name, kind=kind, born=born, expires=expires))})


class LiquidityTests(unittest.TestCase):
    def event(self, item, high=104, low=99, close=102, previous=101, bar=11, now=1000, penetration=1):
        return LIQUIDITY_EVENT(item, bar, now, high, low, close, previous, penetration)

    def test_low_sweep_requires_reclaim(self):
        item = level()
        self.assertEqual(self.event(item), 1)
        self.assertTrue(item.consumed)
        item = level()
        self.assertEqual(self.event(item, close=99), 0)
        self.assertTrue(item.consumed)

    def test_high_sweep_is_symmetric(self):
        item = level(side=1, name="EQH")
        self.assertEqual(self.event(item, high=101, low=97, close=98, previous=99), -1)
        self.assertTrue(item.consumed)

    def test_same_confirmation_bar_cannot_sweep_new_pool(self):
        item = level()
        self.assertEqual(self.event(item, bar=10), 0)
        self.assertFalse(item.consumed)
        self.assertEqual(self.event(item, bar=11), 1)

    def test_consumed_pool_cannot_fire_again(self):
        item = level()
        self.assertEqual(self.event(item), 1)
        self.assertEqual(self.event(item, bar=12), 0)

    def test_breakout_is_consumed_without_later_reclaim_signal(self):
        item = level(side=1)
        self.assertEqual(self.event(item, high=105, close=104, previous=99), 0)
        self.assertEqual(self.event(item, close=98, previous=104, bar=12), 0)

    def test_approach_from_wrong_side_is_not_a_sweep(self):
        item = level()
        self.assertEqual(self.event(item, previous=98), 0)
        self.assertTrue(item.consumed)

    def test_equal_touch_is_not_penetration(self):
        item = level()
        self.assertEqual(self.event(item, low=100), 0)
        self.assertFalse(item.consumed)

    def test_shallow_raid_consumes_but_does_not_qualify(self):
        item = level()
        self.assertEqual(self.event(item, low=99.5, penetration=1), 0)
        self.assertTrue(item.consumed)
        self.assertEqual(self.event(item, bar=12), 0)

    def test_time_expiry_boundary(self):
        self.assertEqual(self.event(level(expires=1000)), 0)
        self.assertEqual(self.event(level(expires=1001)), 1)

    def test_bar_expiry_counts_bars_not_weekend_time(self):
        self.assertEqual(self.event(level(expiresBar=11), bar=11), 1)
        self.assertEqual(self.event(level(expiresBar=11), bar=12), 0)

    def test_outside_bar_reports_both_sides_for_ambiguity_gate(self):
        self.assertEqual(self.event(level(98), high=103, low=97, close=100, previous=100), 1)
        self.assertEqual(self.event(level(102, 1), high=103, low=97, close=100, previous=100), -1)
        self.assertIn("if sweptLow and not sweptHigh", TEXT)
        self.assertIn("if sweptHigh and not sweptLow", TEXT)

    def test_eqh_tolerance_and_outer_edge(self):
        self.assertTrue(EQUAL_POOL(100, 100.5, 100.5, 0.5, 10, 3, 250, 1))
        self.assertFalse(EQUAL_POOL(100, 100.6, 100.6, 0.5, 10, 3, 250, 1))
        self.assertFalse(EQUAL_POOL(100, 100.5, 101, 0.5, 10, 3, 250, 1))

    def test_eql_rejects_intervening_lower_low(self):
        self.assertTrue(EQUAL_POOL(100, 99.5, 99.5, 0.5, 10, 3, 250, -1))
        self.assertFalse(EQUAL_POOL(100, 99.5, 99, 0.5, 10, 3, 250, -1))

    def test_equal_pool_requires_two_separated_recent_pivots(self):
        self.assertFalse(EQUAL_POOL(None, 100, 100, 0.5, 10, 3, 250, 1))
        self.assertFalse(EQUAL_POOL(100, 100, 100, 0.5, 2, 3, 250, 1))
        self.assertFalse(EQUAL_POOL(100, 100, 100, 0.5, 251, 3, 250, 1))

    def test_local_long_requires_discount_of_valid_frozen_range(self):
        self.assertTrue(LOCAL_LOCATION(1, 102, 98, 110))
        self.assertTrue(LOCAL_LOCATION(1, 104, 98, 110))
        self.assertFalse(LOCAL_LOCATION(1, 105, 98, 110))
        self.assertFalse(LOCAL_LOCATION(1, 97, 98, 110))
        self.assertFalse(LOCAL_LOCATION(1, 102, 110, 98))
        self.assertFalse(LOCAL_LOCATION(1, 102, None, 110))

    def test_local_short_requires_premium(self):
        self.assertTrue(LOCAL_LOCATION(-1, 106, 110, 98))
        self.assertFalse(LOCAL_LOCATION(-1, 103, 110, 98))
        self.assertFalse(LOCAL_LOCATION(-1, 111, 110, 98))

    def test_target_selects_nearest_not_best_r(self):
        near, far = level(110, 1), level(130, 1)
        self.assertIs(NEAREST_LIQUIDITY([far, near], 1, 105, 11, 1000), near)
        near, far = level(90), level(70)
        self.assertIs(NEAREST_LIQUIDITY([far, near], -1, 95, 11, 1000), near)

    def test_target_excludes_daily_open_used_expired_and_same_bar(self):
        excluded = [level(110, 1, consumed=True), level(111, 1, expires=1000),
                    level(112, 1, born=11), level(113, 1, kind="Daily open"),
                    level(114, 1, expiresBar=10), level(115, -1)]
        self.assertIsNone(NEAREST_LIQUIDITY(excluded, 1, 105, 11, 1000))

    def test_target_must_be_beyond_entire_confirmation_bar(self):
        self.assertIsNone(NEAREST_LIQUIDITY([level(105, 1)], 1, 105, 11, 1000))
        self.assertIsNone(NEAREST_LIQUIDITY([level(104, 1)], 1, 105, 11, 1000))

    def test_coincident_targets_prefer_named_pool(self):
        swing, eq = level(110, 1, kind="Swing"), level(110, 1, kind="EQ")
        self.assertIs(NEAREST_LIQUIDITY([swing, eq], 1, 105, 11, 1000), eq)

    def test_registry_bounded_and_preserves_newest(self):
        registry = PineArray()
        for i in range(100):
            ADD_LIQUIDITY(registry, i, 1, "H", "Swing", i, 10000, i + 250)
        self.assertEqual(len(registry), 80)
        self.assertEqual(registry[0].price, 20)
        self.assertEqual(registry[-1].expiresBar, 349)
        ADD_LIQUIDITY(registry, None, 1, "H", "Swing", 101, 10000, 351)
        self.assertEqual(len(registry), 80)

    def test_references_freeze_at_break_and_candidate(self):
        for wiring in ["bullBreakName := bullSweepName", "bearBreakName := bearSweepName",
                       "bullBreakStructure := bullMssLevel", "ict.sweepName := ictModeInput",
                       'ict.targetName := ictTargetInput', 'ict.locationAvailable := localLocation ?']:
            self.assertIn(wiring, TEXT)
        self.assertLess(TEXT.index("bool sweptLow ="), TEXT.index("if combinedLiquidity and liqEqualInput and equal_pool_valid"))

    @staticmethod
    def publisher(now=2000, mode="Combined liquidity"):
        return load_function(one_helper("publish_liquidity_session"), {
            "time": now, "bar_index": 20, "ictSweepInput": mode,
            "str": SimpleNamespace(format_time=lambda *args: "30 Oct"),
            "add_liquidity": ADD_LIQUIDITY})

    @staticmethod
    def session(**changes):
        values = dict(anchor=1000, ending=2000, hi=110., lo=90., complete=True,
                      published=False, status="Building")
        values.update(changes)
        return SimpleNamespace(**values)

    def test_completed_session_publishes_once_with_both_names(self):
        registry, session = PineArray(), self.session()
        publish = self.publisher()
        publish(session, registry, "Asia", "Etc/UTC", 5000, "Session")
        publish(session, registry, "Asia", "Etc/UTC", 5000, "Session")
        self.assertEqual(len(registry), 2)
        self.assertEqual([x.name for x in registry], ["Asia 30 Oct H", "Asia 30 Oct L"])
        self.assertEqual(registry[0].expires, 7000)

    def test_partial_session_never_publishes_reference(self):
        registry, session = PineArray(), self.session(complete=False)
        self.publisher()(session, registry, "Asia", "Etc/UTC", 5000, "Session")
        self.assertEqual(len(registry), 0)
        self.assertEqual(session.status, "Incomplete / misaligned range excluded")

    def test_final_session_candle_cannot_sweep_its_own_high(self):
        registry, session = PineArray(), self.session()
        self.publisher(now=1999)(session, registry, "Asia", "Etc/UTC", 5000, "Session")
        self.assertEqual(registry[0].born, 20)
        self.assertEqual(self.event(registry[0], high=111, low=100, close=105, previous=105, bar=20, now=1999), 0)
        self.assertEqual(self.event(registry[0], high=111, low=100, close=105, previous=105, bar=21, now=2000), -1)

    def test_gap_after_session_end_can_raid_already_closed_range(self):
        registry, session = PineArray(), self.session()
        self.publisher(now=2100)(session, registry, "Asia", "Etc/UTC", 5000, "Session")
        self.assertEqual(registry[0].born, 19)
        self.assertEqual(self.event(registry[0], high=111, low=100, close=105, previous=105, bar=20, now=2100), -1)

    def test_old_single_session_mode_replaces_even_if_new_range_partial(self):
        old = level(kind="Prior session")
        registry, session = PineArray([old]), self.session(complete=False)
        self.publisher(mode="Previous session")(session, registry, "Prior session", "Etc/UTC", 5000, "Prior session")
        self.assertTrue(old.consumed)
        self.assertEqual(len(registry), 1)

    def test_combined_mode_retains_older_unswept_sessions(self):
        old = level(kind="Prior session")
        registry, session = PineArray([old]), self.session()
        self.publisher()(session, registry, "Prior session", "Etc/UTC", 5000, "Prior session")
        self.assertFalse(old.consumed)
        self.assertEqual(len(registry), 3)

    def test_source_defaults_and_daily_open_are_explicit(self):
        self.assertIn('input.string("Combined liquidity", "Reversal sweep reference"', TEXT)
        self.assertIn('input.string("Context only", "Daily open role"', TEXT)
        self.assertIn('combinedLiquidity and liqDailyOpenInput == "Reclaim trigger" and openingObserved', TEXT)
        self.assertIn('time_close[1] <= liquidityDay', TEXT)
        self.assertIn('workflow_row(ictPanel, 13, "Daily open"', TEXT)

    def test_session_ranges_require_observed_aligned_completion(self):
        self.assertIn('session.complete := observed_session_start(anchorTime, time[1], time, barstate.isfirst)', TEXT)
        self.assertIn('session.complete := session.complete and openTime == time and closeTime == time_close', TEXT)
        self.assertIn('if session.complete and not na(session.hi)', TEXT)
        self.assertIn('if time_close >= session.ending', TEXT)
        self.assertIn('newPressureSession and (level.kind == "Swing" or level.kind == "EQ")', TEXT)


class WorkflowTests(unittest.TestCase):
    def test_exact_open_after_prior_history(self):
        self.assertTrue(OBSERVED_START(100, 99, 100, False))

    def test_closed_market_does_not_need_midnight_bar(self):
        self.assertTrue(OBSERVED_START(100, 90, 110, False))

    def test_first_loaded_period_remains_partial(self):
        self.assertFalse(OBSERVED_START(100, None, 110, True))
        self.assertFalse(OBSERVED_START(100, None, 100, True))

    def test_history_starting_inside_period_is_not_complete(self):
        self.assertFalse(OBSERVED_START(100, 105, 110, False))
        self.assertFalse(OBSERVED_START(100, 90, 95, False))

    def test_zero_volume_is_not_a_traded_data_gap(self):
        self.assertFalse(MISSING_FLOW(False, 0))
        self.assertFalse(MISSING_FLOW(True, 100))
        self.assertTrue(MISSING_FLOW(False, 100))
        self.assertTrue(MISSING_FLOW(False, None))

    def test_unavailable_is_not_failed(self):
        self.assertEqual(ASSESSMENT(True, False, True, False), "Unavailable")
        self.assertEqual(ASSESSMENT(True, True, True, False), "Failed")

    def test_unassessed_is_not_passed(self):
        self.assertEqual(ASSESSMENT(True, True, False, True), "Waiting")
        self.assertEqual(ASSESSMENT(True, True, True, True), "Passed")
        self.assertEqual(ASSESSMENT(False, False, False, False), "Off")

    def test_old_results_do_not_replace_current_workflow(self):
        self.assertIn('workflowCandidate := ict.direction != 0 and (ict.active or ict.updated == bar_index)', TEXT)
        self.assertIn('"Last result", "History"', TEXT)
        self.assertIn('if enableIctInput and barstate.isconfirmed\n    workflowBar', TEXT)
        self.assertIn('ict.locationReason := localLocation ?', TEXT)
        self.assertIn('ict.targetReason := ictTargetInput ==', TEXT)


class PineMap(dict):
    def contains(self, key):
        return key in self

    def size(self):
        return len(self)

    def put(self, key, value):
        self[key] = value


def candidate(direction=1, **changes):
    values = dict(direction=direction, born=10, active=True, state="CONDITIONS MET",
                  reason="Prequalified", bottom=100., top=104., entry=102., stop=96.,
                  target=120., firstTouch=None, zone=None, rr=3., roomOk=True)
    if direction < 0:
        values.update(stop=108., target=84.)
    values.update(changes)
    return SimpleNamespace(**values)


def step(c, **changes):
    args = dict(atBar=11, barOpen=106., barHigh=108., barLow=105., barClose=107.,
                previousClose=106., barDeltaPercent=30., newSession=False,
                inSession=True, dataAvailable=True, executionMode="Limit at FVG",
                expiryBars=12, zoneExpiryBars=60, requireImbalance=True,
                requireRoom=True, minimumR=1.5, reactionDelta=15.)
    args.update(changes)
    return LIFECYCLE(c, **args)


class LifecycleTests(unittest.TestCase):
    def test_adapter_nested_ternary_and_precedence(self):
        expr = Expression.translate('true and (false ? 1 : 2) == 2 ? "yes" : "no"')
        self.assertEqual(eval(expr), "yes")

    def test_creation_bar_cannot_be_its_own_entry(self):
        c = candidate()
        self.assertFalse(step(c, atBar=10, barLow=99.))
        self.assertTrue(c.active)

    def test_waiting_limit_does_not_consume_current_delta(self):
        c = candidate()
        step(c, barDeltaPercent=-99.)
        self.assertEqual(c.state, "CONDITIONS MET")

    def test_long_limit_touch_is_not_a_fill_claim(self):
        c = candidate()
        step(c, barLow=101., barDeltaPercent=-99.)
        self.assertEqual(c.state, "ENTRY TOUCHED")
        self.assertIn("unverified", c.reason)
        self.assertFalse(c.active)

    def test_short_limit_touch(self):
        c = candidate(-1)
        step(c, barOpen=99., barHigh=103., barLow=98., barClose=99., previousClose=99.)
        self.assertEqual(c.state, "ENTRY TOUCHED")

    def test_same_bar_stop_and_touch_never_claims_an_entry(self):
        c = candidate()
        step(c, barLow=95.)
        self.assertEqual(c.state, "INVALIDATED")
        self.assertIn("ambiguous", c.reason)

    def test_same_bar_target_and_touch_needs_review(self):
        c = candidate()
        step(c, barLow=101., barHigh=121.)
        self.assertEqual(c.state, "REVIEW")

    def test_target_before_retest_expires(self):
        c = candidate()
        step(c, barHigh=121.)
        self.assertEqual(c.state, "EXPIRED")

    def test_target_filter_can_be_disabled(self):
        c = candidate()
        step(c, barHigh=121., requireRoom=False)
        self.assertTrue(c.active)

    def test_expiry_boundary_is_inclusive(self):
        c = candidate()
        step(c, atBar=22)
        self.assertTrue(c.active)
        step(c, atBar=23)
        self.assertEqual(c.state, "EXPIRED")

    def test_new_session_expires_even_without_outside_bars(self):
        c = candidate()
        step(c, newSession=True)
        self.assertEqual(c.state, "EXPIRED")

    def test_outside_session_expires(self):
        c = candidate()
        step(c, inSession=False)
        self.assertEqual(c.state, "EXPIRED")

    def test_missing_native_withdraws_qualification(self):
        c = candidate()
        step(c, dataAvailable=False, barLow=101.)
        self.assertEqual(c.state, "INSUFFICIENT DATA")

    def test_rejected_candidate_never_promotes_after_good_retest(self):
        c = candidate(active=False, state="FILTERED")
        step(c, executionMode="Confirmed retest", barLow=101.)
        self.assertEqual(c.state, "FILTERED")

    def test_reaction_needs_a_retest(self):
        c = candidate(state="WAITING")
        self.assertFalse(step(c, executionMode="Confirmed retest"))
        self.assertIsNone(c.firstTouch)

    def test_retest_needs_directional_response(self):
        c = candidate(state="WAITING")
        self.assertFalse(step(c, executionMode="Confirmed retest", barLow=101., barDeltaPercent=-30.))
        self.assertEqual(c.firstTouch, 11)
        self.assertEqual(c.state, "WAITING")

    def test_confirmation_recalculates_R_at_close(self):
        c = candidate(state="WAITING")
        qualified = step(c, executionMode="Confirmed retest", barOpen=102., barLow=101., barClose=105.)
        self.assertTrue(qualified)
        self.assertEqual(c.entry, 105.)
        self.assertAlmostEqual(c.rr, 15 / 9)

    def test_late_confirmation_can_fail_R(self):
        c = candidate(state="WAITING")
        qualified = step(c, executionMode="Confirmed retest", barLow=101., barClose=107.)
        self.assertFalse(qualified)
        self.assertEqual(c.state, "FILTERED")
        self.assertAlmostEqual(c.rr, 13 / 11)

    def test_short_confirmation_is_symmetric(self):
        c = candidate(-1, state="WAITING")
        qualified = step(c, executionMode="Confirmed retest", barOpen=102., barHigh=103., barLow=98., barClose=99., previousClose=98., barDeltaPercent=-30.)
        self.assertTrue(qualified)
        self.assertAlmostEqual(c.rr, 15 / 9)

    def test_zone_breach_survives_display_eviction(self):
        c = candidate(zone=SimpleNamespace(bottom=103., top=104., born=9))
        step(c, barLow=101., barClose=102.)
        self.assertEqual(c.state, "INVALIDATED")

    def test_zone_filter_off_ignores_zone_breach(self):
        c = candidate(zone=SimpleNamespace(bottom=103., top=104., born=9))
        step(c, barLow=101., barClose=102., requireImbalance=False)
        self.assertEqual(c.state, "ENTRY TOUCHED")

    def test_zone_expiry(self):
        c = candidate(zone=SimpleNamespace(bottom=100., top=101., born=1))
        step(c, zoneExpiryBars=5)
        self.assertEqual(c.state, "EXPIRED")

    def test_terminal_candidate_does_not_emit_twice(self):
        c = candidate()
        step(c, barLow=101.)
        reason = c.reason
        self.assertFalse(step(c, atBar=12, barLow=95.))
        self.assertEqual(c.state, "ENTRY TOUCHED")
        self.assertEqual(c.reason, reason)

    def test_no_target_is_not_manufactured(self):
        c = candidate(target=None, state="WAITING")
        self.assertFalse(step(c, executionMode="Confirmed retest", barOpen=102., barLow=101., barClose=105.))
        self.assertEqual(c.state, "FILTERED")
        self.assertIsNone(c.rr)


class ProfileAndSessionTests(unittest.TestCase):
    def test_native_row_volume_conservation_across_grids(self):
        for bottom, top, size in [(100, 101, 1), (100.2, 100.7, 2.5), (-2, -1, 1), (0, 0.25, 0.25), (25000.1, 25001.1, 3.5)]:
            with self.subTest(bottom=bottom, size=size):
                buys, sells = PineMap(), PineMap()
                self.assertTrue(PROFILE_RANGE(buys, sells, bottom, top, size, 73., 27.))
                self.assertAlmostEqual(sum(buys.values()), 73.)
                self.assertAlmostEqual(sum(sells.values()), 27.)
                self.assertTrue(all(v >= 0 for v in buys.values()))

    def test_adjacent_rows_merge_without_double_counting(self):
        buys, sells = PineMap(), PineMap()
        for price in range(100, 110):
            PROFILE_RANGE(buys, sells, price, price + 1, 3, 7, 3)
        self.assertAlmostEqual(sum(buys.values()) + sum(sells.values()), 100.)

    def test_capacity_failure_is_reported(self):
        buys = PineMap({i: 1. for i in range(2500)})
        sells = PineMap({i: 1. for i in range(2500)})
        self.assertFalse(PROFILE_ADD(buys, sells, 2500, 5, 5))
        self.assertEqual(len(buys), 2500)
        self.assertTrue(PROFILE_ADD(buys, sells, 2499, 5, 5))

    @staticmethod
    def anchor(when, session, timezone):
        # Evaluate the actual four production assignments with timezone adapters.
        stamp = int(when.timestamp() * 1000)
        zone = ZoneInfo(timezone)
        def timestamp(tz, year, month, day, hour, minute):
            date = datetime(year, month, 1) + timedelta(days=day - 1)
            return int(date.replace(hour=hour, minute=minute, tzinfo=ZoneInfo(tz)).timestamp() * 1000)
        namespace = dict(time=stamp, profileTimezone=timezone, profileSessionInput=session,
                         timestamp=timestamp, year=lambda t, tz: datetime.fromtimestamp(t / 1000, ZoneInfo(tz)).year,
                         month=lambda t, tz: datetime.fromtimestamp(t / 1000, ZoneInfo(tz)).month,
                         dayofmonth=lambda t, tz: datetime.fromtimestamp(t / 1000, ZoneInfo(tz)).day,
                         str=SimpleNamespace(tonumber=float, substring=lambda s, a, b: s[a:b]))
        block = TEXT.split("int sessionStartHour = ", 1)[1].split("var int lastConfiguredSessionId", 1)[0]
        for line in ("int sessionStartHour = " + block).strip().splitlines():
            left, right = line.split(" = ", 1)
            namespace[left.split()[-1]] = eval(Expression.translate(right), namespace)
        return datetime.fromtimestamp(namespace["configuredSessionId"] / 1000, zone)

    def test_full_day_and_session_restricted_reset(self):
        tz = ZoneInfo("Europe/Bucharest")
        for session in ["0000-0000", "0900-1700"]:
            a = self.anchor(datetime(2026, 10, 28, 10, tzinfo=tz), session, str(tz))
            b = self.anchor(datetime(2026, 10, 29, 10, tzinfo=tz), session, str(tz))
            self.assertNotEqual(a, b)

    def test_overnight_session_and_year_boundary(self):
        tz = ZoneInfo("America/New_York")
        a = self.anchor(datetime(2026, 12, 31, 20, tzinfo=tz), "1800-1700", str(tz))
        b = self.anchor(datetime(2027, 1, 1, 10, tzinfo=tz), "1800-1700", str(tz))
        self.assertEqual(a, b)
        self.assertEqual(b, datetime(2026, 12, 31, 18, tzinfo=tz))

    def test_dst_session_anchor_uses_calendar_arithmetic(self):
        tz = ZoneInfo("Europe/Bucharest")
        for month, day in [(3, 29), (10, 25)]:
            a = self.anchor(datetime(2026, month, day, 10, tzinfo=tz), "1800-1700", str(tz))
            self.assertEqual(a, datetime(2026, month, day - 1, 18, tzinfo=tz))


class SourceContractTests(unittest.TestCase):
    def test_single_native_request_and_no_extra_plot_budget(self):
        self.assertEqual(TEXT.count("request.footprint("), 1)
        self.assertEqual(len(re.findall(r"^plot\(", TEXT, re.M)), 12)
        self.assertEqual(len(re.findall(r"^alertcondition\(", TEXT, re.M)), 14)

    def test_no_current_sample_in_participation_baselines(self):
        self.assertIn("relativeVolumeLengthInput)[1]", TEXT)
        self.assertIn("for offset = 1 to timeRvolSessionsInput", TEXT)
        self.assertIn("ict.rvol := entryRelativeVolume[1]", TEXT)

    def test_no_same_bar_structure_or_retest_lookahead(self):
        self.assertIn("bullBreakBar <= bar_index - 1", TEXT)
        self.assertIn("bar_index > bullSweepBar", TEXT)
        self.assertIn("if enableIctInput and barstate.isconfirmed", TEXT)
        self.assertNotIn("lookahead_on", TEXT)

    def test_bounded_objects_and_history(self):
        self.assertIn("while flowZones.size() > zoneLimitEffective", TEXT)
        self.assertIn("while ictLabels.size() > retainedIctLabels", TEXT)
        self.assertLessEqual(200 * 2 + 30 + 1, 500)


class TimeframePresetTests(unittest.TestCase):
    @staticmethod
    def effective(seconds, **overrides):
        defaults = re.findall(r'\b(\w+) = input\.(?:int|float|bool|string)\(\s*("[^"\n]*"|true|false|\d+(?:\.\d+)?)', TEXT)
        env = {name: eval(Expression.translate(value)) for name, value in defaults}
        env.update(overrides)
        env.update(timeframe=SimpleNamespace(in_seconds=lambda: seconds),
                   nz=lambda value, fallback: fallback if value is None else value,
                   math=SimpleNamespace(min=min, max=max, ceil=math.ceil, abs=abs, avg=lambda a, b: (a + b) / 2))
        block = TEXT.split("simple int presetSeconds = ", 1)[1].split("string effectiveSettingsText", 1)[0]
        for line in ("simple int presetSeconds = " + block).strip().splitlines():
            left, right = line.split(" = ", 1)
            env[left.split()[-1]] = eval(Expression.translate(right), env)
        return env

    def test_defaults_are_auto_and_entry_focus(self):
        e = self.effective(60)
        self.assertTrue(e["automaticTuning"])
        self.assertTrue(e["entryFocus"])
        self.assertEqual(e["retainedIctLabels"], 8)
        self.assertEqual(e["zoneLimitEffective"], 4)
        self.assertEqual(e["ictAlertScopeInput"], "Qualified entries")

    def test_timeframe_boundaries(self):
        for seconds, expected in [(5, 0), (45, 0), (60, 1), (120, 2), (300, 2), (600, 3), (900, 3), (1800, 4), (3600, 4), (14400, 5), (86400, 5)]:
            with self.subTest(seconds=seconds):
                self.assertEqual(self.effective(seconds)["presetBand"], expected)

    def test_one_minute_thresholds_and_confirmation(self):
        e = self.effective(60, confirmedSignalsOnlyInput=False)
        self.assertEqual((e["minimumRelativeVolumeEffective"], e["extremeDeltaPercentEffective"], e["stackedRowsEffective"]), (1.6, 45, 4))
        self.assertEqual(e["ictSwingEffective"], 5)
        self.assertEqual(e["ictExpiryEffective"], 15)
        self.assertTrue(e["effectiveSignalConfirmation"])

    def test_five_minute_preset(self):
        e = self.effective(300)
        self.assertEqual(e["minimumRelativeVolumeEffective"], 1.4)
        self.assertEqual(e["ictSwingEffective"], 4)
        self.assertEqual(e["ictExpiryEffective"], 6)
        self.assertEqual(e["rowTicksEffective"], 8)

    def test_manual_restores_user_values(self):
        overrides = dict(tuningModeInput="Manual", rowTicksInput=7, ictExpiryInput=19,
                         ictSwingInput=6, minimumRelativeVolumeInput=1.1,
                         imbalancePercentInput=275., minimumStackShareInput=3.,
                         confirmedSignalsOnlyInput=False)
        for seconds in [5, 60, 300, 900, 3600, 14400]:
            e = self.effective(seconds, **overrides)
            for stem in ["rowTicks", "ictExpiry", "ictSwing", "minimumRelativeVolume", "imbalancePercent", "minimumStackShare"]:
                self.assertEqual(e[stem + "Effective"], overrides[stem + "Input"])
            self.assertEqual(e["minimumGapAtr"], 0)
            self.assertFalse(e["effectiveSignalConfirmation"])

    def test_row_size_and_expiry_bounds(self):
        for seconds in [1, 5, 60, 300, 900, 3600, 14400, 86400, 604800]:
            e = self.effective(seconds, rowTicksInput=100000)
            self.assertLessEqual(e["rowTicksEffective"], 100000)
            self.assertTrue(3 <= e["zoneExpiryEffective"] <= 500)
            self.assertTrue(2 <= e["contextCooldown"] <= 100)

    def test_effective_parameters_drive_native_data_and_pivots(self):
        self.assertIn("request.footprint(\n     rowTicksEffective,", TEXT)
        self.assertIn("ta.pivothigh(high, ictSwingEffective, ictSwingEffective)", TEXT)
        self.assertIn("ictExpiryEffective, zoneExpiryEffective", TEXT)

    def test_entry_focus_hides_diagnostics_without_gating_candidates(self):
        self.assertIn("bool showContextMarker = not entryFocus", TEXT)
        self.assertIn("bool showTransitionLabel = fullDiagnostics or ictQualifiedEvent", TEXT)
        condition = next(line for line in TEXT.splitlines() if "if not candidateWasActive and" in line)
        self.assertNotIn("entryFocus", condition)
        self.assertNotIn("contextCooldown", condition)


def write_harness(path):
    types = "type LiquidityLevel\n" + TEXT.split("type LiquidityLevel\n", 1)[1].split("var array<FlowZone>", 1)[0]
    checks = [
        ("10, 106, 108, 101, 107, 106, 30, false, true, true", 'c.active and c.state == "CONDITIONS MET"', "no creation-bar touch"),
        ("11, 106, 108, 101, 107, 106, -99, false, true, true", 'not c.active and c.state == "ENTRY TOUCHED"', "limit prequalification ignores future delta"),
        ("11, 106, 108, 95, 107, 106, 30, false, true, true", 'c.state == "INVALIDATED"', "stop and touch ambiguity"),
        ("11, 106, 121, 101, 107, 106, 30, false, true, true", 'c.state == "REVIEW"', "target and touch ambiguity"),
        ("11, 106, 108, 101, 107, 106, 30, false, true, false", 'c.state == "INSUFFICIENT DATA"', "data loss blocks touch"),
        ("11, 106, 108, 105, 107, 106, 30, true, true, true", 'c.state == "EXPIRED"', "session reset without outside bars"),
        ("23, 106, 108, 105, 107, 106, 30, false, true, true", 'c.state == "EXPIRED"', "expiry from FVG confirmation"),
    ]
    out = ['//@version=6', 'indicator("QA · Volume Profile ICT Lifecycle", overlay=true)', types, one_helper("liquidity_event"), one_helper("equal_pool_valid"), one_helper("local_location_ok"), HELPER,
           'fresh_candidate() =>', '    IctCandidate c = IctCandidate.new()',
           '    c.direction := 1', '    c.born := 10', '    c.active := true',
           '    c.state := "CONDITIONS MET"', '    c.bottom := 100', '    c.top := 104',
           '    c.entry := 102', '    c.stop := 96', '    c.target := 120', '    c',
           'var int passed = 0', 'if barstate.isfirst', '    IctCandidate c = na']
    for args, assertion, description in checks:
        out += ['    c := fresh_candidate()', f'    update_ict_candidate(c, {args}, "Limit at FVG", 12, 60, true, true, 1.5, 15)',
                f'    if not ({assertion})', f'        runtime.error("FAIL: {description}")', '    passed += 1']
    out += ['    c := fresh_candidate()',
            '    bool qualified = update_ict_candidate(c, 11, 102, 108, 101, 105, 106, 30, false, true, true, "Confirmed retest", 12, 60, true, true, 1.5, 15)',
            '    if not qualified or math.abs(c.rr - 15.0 / 9.0) > 0.00001',
            '        runtime.error("FAIL: confirmation must reprice risk")', '    passed += 1',
            '    LiquidityLevel l = LiquidityLevel.new(100, -1, "EQL", "EQ", 10, 10000)',
            '    if liquidity_event(l, 10, 1000, 104, 99, 102, 101, 1) != 0 or l.consumed',
            '        runtime.error("FAIL: no confirmation-bar pool sweep")', '    passed += 1',
            '    if liquidity_event(l, 11, 1000, 104, 99, 102, 101, 1) != 1 or not l.consumed',
            '        runtime.error("FAIL: EQL sweep and reclaim")', '    passed += 1',
            '    if liquidity_event(l, 12, 1000, 104, 99, 102, 101, 1) != 0',
            '        runtime.error("FAIL: consumed pool repeated")', '    passed += 1',
            '    l := LiquidityLevel.new(100, 1, "EQH", "EQ", 10, 10000)',
            '    if liquidity_event(l, 11, 1000, 101, 97, 98, 99, 1) != -1',
            '        runtime.error("FAIL: EQH sweep symmetry")', '    passed += 1',
            '    if not equal_pool_valid(100, 100.5, 100.5, 0.5, 10, 3, 250, 1) or equal_pool_valid(100, 100.5, 101, 0.5, 10, 3, 250, 1)',
            '        runtime.error("FAIL: equal-pool tolerance / intervening raid")', '    passed += 1',
            '    if not local_location_ok(1, 102, 98, 110) or local_location_ok(1, 105, 98, 110)',
            '        runtime.error("FAIL: local long discount")', '    passed += 1',
            '    if not local_location_ok(-1, 106, 110, 98) or local_location_ok(-1, 103, 110, 98)',
            '        runtime.error("FAIL: local short premium")', '    passed += 1',
            'var table result = table.new(position.top_right, 1, 1)', 
            'if barstate.islast', '    table.cell(result, 0, 0, "PASS · " + str.tostring(passed) + " lifecycle / liquidity checks", bgcolor=color.green, text_color=color.white)']
    path.write_text("\n".join(out) + "\n")
    print(f"Generated {path.name}; not executed in TradingView.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-harness", type=Path)
    args = parser.parse_args()
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(__import__(__name__)))
    if not result.wasSuccessful():
        raise SystemExit(1)
    if args.write_harness:
        write_harness(args.write_harness)
