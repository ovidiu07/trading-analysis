### Scope and method
You asked which methods from each tv_ library are not used, to help refactor `version1-improving-dev.pine` to lean on libraries where possible. I audited the attached libraries and cross‑referenced all direct calls originating from `version1-improving-dev.pine` (file is 3799 lines). For context, some helpers are used transitively by the UI libraries (e.g., `tv_readiness_ui` uses `tv_dashboard_utils`), but below I flag two views where relevant:
- Directly used by `version1-improving-dev.pine` (primary scope)
- Transitive usage via other libraries (not called by the main file itself)

For each library, I list unused exported methods relative to `version1-improving-dev.pine` and show sample line anchors for used ones.

---

### tv_signal_gate_engine.pine
Exports: `ict_liquidity_gate`, `silver_bullet_liquidity_gate`
- Used directly in main:
  - `sg.ict_liquidity_gate` at lines ~1934, 1936
  - `sg.silver_bullet_liquidity_gate` at lines ~1938, 1940
- Unused exports: None (all exported functions are used)

---

### tv_render_utils.pine
Exports: `render_level`, `draw_preview`, `render_managed_box`, `render_managed_tag`, `render_historical_zone`, `delete_group`, `safe_delete_line`, `safe_delete_label`, `safe_delete_box`, `clear_preview`
- Used directly in main:
  - `ren.render_level` at ~3219–3238
  - `ren.draw_preview` at ~3773
  - `ren.clear_preview` at ~3779
- Unused exports in main:
  - `render_managed_box`
  - `render_managed_tag`
  - `render_historical_zone`
  - `delete_group`
  - `safe_delete_line`
  - `safe_delete_label`
  - `safe_delete_box`

Refactor opportunities:
- If you maintain any persistent historical zones/labels in the main file, you can replace custom box/label lifecycle code with `render_historical_zone` and/or `render_managed_box`/`render_managed_tag`.
- Use `delete_group`/`safe_delete_*` for centralized cleanup instead of ad‑hoc `line.delete/label.delete/box.delete` calls.

---

### tv_readiness_ui.pine
Exports: types `PrimaryDisplay`, `ContextDisplay`, `AdvancedDisplay`, `LifecycleDisplay`, `PerfDisplay`; functions `render_primary`, `render_context`, `render_scores`, `render_strategy`, `render_advanced`, `render_lifecycle`, `render_performance`
- Used directly in main:
  - Types instantiated and passed
  - `rdash.render_primary` ~3343
  - `rdash.render_context` ~3432
  - `rdash.render_scores` ~3433
  - `rdash.render_strategy` ~3434
  - `rdash.render_advanced` ~3516
  - `rdash.render_lifecycle` ~3668
  - `rdash.render_performance` ~3681
- Unused exports: None (all exported renderers are used)

---

### tv_market_intel_ui.pine
Exports: types `AlertEntry`, `OBEntry`; function `render_market_intel`
- Used directly in main:
  - `intel.AlertEntry` and `intel.OBEntry` arrays and constructors at ~3699–3716
  - `intel.render_market_intel` at ~3717
- Unused exports: None (all exported items are used)

---

### tv_format_utils.pine
Exports: `resolve_pos`, `format_quality`, `format_confidence`, `format_bias`, `format_dir`, `format_check`, `val_or_dash`, `str_or_dash`, `format_pct`, `format_r`, `format_age`
- Used directly in main:
  - `fmt.resolve_pos` at ~3261, ~3687
  - `fmt.format_confidence` at ~3289
  - `fmt.format_bias` at ~3294
  - `fmt.format_quality` at ~3354–3357
- Unused exports in main:
  - `format_dir`
  - `format_check`
  - `val_or_dash`
  - `str_or_dash`
  - `format_pct`
  - `format_r`
  - `format_age`

Refactor opportunities:
- Replace duplicated directional labels with `format_dir`.
- Use `format_check` for pass/fail badges in the debug/lifecycle sections.
- Prefer `val_or_dash`/`str_or_dash` for consistent N/A fallbacks.
- Use `format_pct` for percentages and `format_r` for R‑metrics in the performance block.
- Use `format_age` for “X bars ago” formatting where age strings are built manually.

---

### tv_dashboard_utils.pine
Exports (subset): `table_header`, `table_section`, `table_kv_emph`, `table_kv`, `table_kv_muted`, `table_guidance`, `table_header3`, `table_row3_emph`, `table_row3`, `table_row3_muted`, `table_empty3`, `table_merge_row`, `table_section3`, `table_kv3`
- Direct usage by main: None (the main does not call `tbl.*` directly)
- Transitive usage via UI libs:
  - `tv_readiness_ui` uses: `table_section`, `table_kv`
  - `tv_market_intel_ui` uses: `table_merge_row`, `table_kv3`, `table_section3`, `table_header3`, `table_row3`, `table_empty3`
- Likely unused across the provided set (neither main nor these two UI libs call):
  - `table_header` (2‑col)
  - `table_kv_emph`
  - `table_kv_muted`
  - `table_guidance`
  - `table_row3_emph`
  - `table_row3_muted`

If you plan to add richer styling/weighting to dashboard rows in `version1-improving-dev`, consider the unused emphasized/muted variants instead of custom formatting.

---

### tv_entry_authority.pine
Key exports: naming (`ea_name`, `ep_name`, `eb_name`, `ea_action_text`), helpers (`ea_allows_activation`, `ea_allows_pending`, `ea_is_structurally_valid`, `ea_is_terminal`), evaluators (`assess_structural_validity`, `assess_execution_readiness`, `evaluate_entry_authority`, `validate_entry_authority`, `can_promote_to_active`)
- Used directly in main (sample anchors):
  - `evaluate_entry_authority` ~2251, ~2266
  - `ea_is_terminal` ~2300–2318, ~3015–3018, ~3270, ~3752
  - `ea_name` ~2303, ~3007, ~3139–3141, ~3608, ~3610
  - `eb_name` ~2312, ~2316, ~3613
  - `ea_allows_pending` ~2341, ~2354
  - `validate_entry_authority` ~2996
  - `ea_action_text` ~3287
  - `ep_name` ~3562, ~3611
  - `can_promote_to_active` ~2474
- Unused exports in main:
  - `assess_structural_validity`
  - `assess_execution_readiness`
  - `ea_allows_activation`
  - `ea_is_structurally_valid`

Note: main uses the central orchestrator (`evaluate_entry_authority`) which already incorporates the “assess_*” logic, so those layer‑A/B helpers are optional if you don’t need stepwise explanations.

---

### tv_structure_engine.pine
Key exports: `evaluate_reclaim_stage`, `reclaim_mode_pass`, `classify_mss_trigger`, `evaluate_break_quality`, `evaluate_mss_stage`, `mss_mode_pass`, `compute_extension_block`, `evaluate_mss_quality`, `evaluate_displacement_stage`, `displacement_mode_pass`, `evaluate_displacement_bridge`
- Used directly in main:
  - `evaluate_reclaim_stage` ~1799–1800
  - `evaluate_mss_stage` ~1822–1824
  - `evaluate_displacement_stage` ~1845–1847
  - `displacement_mode_pass` ~1866–1867
  - `reclaim_mode_pass` ~2008, ~2013
  - `compute_extension_block` ~2019–2020
  - `mss_mode_pass` ~2023, ~2025
  - `evaluate_displacement_bridge` ~2029–2030
- Unused exports in main:
  - `classify_mss_trigger` (used internally by `evaluate_mss_stage`)
  - `evaluate_break_quality` (used internally by `evaluate_mss_stage`)
  - `evaluate_mss_quality`

You could call `evaluate_mss_quality` directly if you want a standalone MSS quality gate for UI, but current main logic derives this via `evaluate_mss_stage` + `mss_mode_pass`.

---

### tv_lifecycle_mode.pine
Exports: naming/action (`lifecycle_name`, `lifecycle_action_text`, `lifecycle_next_required`), predicates (`lifecycle_allows_activation`, `lifecycle_is_preconfirmation`, `lifecycle_is_terminal`), mode policy (`mode_min_lifecycle_for_candidate`, `mode_min_lifecycle_for_activation`, `mode_requires_retrace_for_activation`, `mode_allows_direct_signal_activation`, `mode_requires_displacement`, `mode_requires_reclaim_proxy`, `mode_name_short`), pending window (`mode_pending_activation_bars`, `pending_setup_is_fresh`, `pending_setup_has_expired`), formatter (`format_action`)
- Used directly in main:
  - `lifecycle_name` at many sites (e.g., ~1588–1590, ~2161–2189, ~3519, etc.)
  - `lifecycle_next_required` ~1589
  - `lifecycle_allows_activation` ~1590
  - `lifecycle_is_preconfirmation` ~2610, ~2614
  - `mode_min_lifecycle_for_candidate` ~2051
  - `mode_min_lifecycle_for_activation` ~2052, ~2629
  - `mode_allows_direct_signal_activation` ~2258, ~2273, ~2637, ~2667, ~2671
  - `mode_pending_activation_bars` ~2343, ~2356, ~3573
  - `mode_name_short` ~2350, ~2363, ~2374, ~2633, ~2653, ~2761, ~2769, ~2859, ~2935
  - `pending_setup_has_expired` ~2217–2218
- Unused exports in main:
  - `lifecycle_is_terminal` (main checks terminality via EA and other flags instead)
  - `lifecycle_action_text` (main uses `ea.ea_action_text` for the headline action)
  - `mode_requires_retrace_for_activation`
  - `mode_requires_displacement`
  - `mode_requires_reclaim_proxy`
  - `pending_setup_is_fresh`
  - `format_action`

Refactor opportunities:
- To show lifecycle‑aware action text in readiness UI, consider `format_action` instead of hand‑assembling strings from EA.
- If you have scattered checks for retrace/displacement/reclaim policy, replace with the mode predicates here for clarity.

---

### tv_core_types.pine
Exports constants (as zero‑arg functions, Pine v6 restriction) and types. These are heavily used throughout the main file and other libraries. There are no “methods” per se beyond constant getters and type declarations, so N/A for this report. If you want, I can do a constant‑level usage map, but it’s verbose and typically not helpful for refactoring.

---

### tv_pending_trade_state.pine
Key exports: `pending_is_structurally_fresh`, `evaluate_mode_execution`, `evaluate_pending_activation`, `method update_stats`, opportunity model helpers (`opp_name`, `opp_allows_entry`, `opp_is_terminal`, `opp_should_invalidate_pending`, `opp_is_chase_forbidden`), and `evaluate_opportunity_state`
- Used directly in main:
  - `evaluate_mode_execution` ~2045–2047
  - `pending_is_structurally_fresh` ~2200–2201
  - `evaluate_pending_activation` ~2221, ~2235
  - `evaluate_opportunity_state` ~2416–2427
  - `opp_should_invalidate_pending` ~2449, ~2453
  - `opp_is_chase_forbidden` ~2461, ~3083, ~3085, ~3756
  - `opp_is_terminal` ~3160
  - `opp_name` ~2452, ~2456, ~3033, ~3046, ~3050, ~3122, ~3126, ~3621, ~3632
  - `update_stats` ~2537 (method on `T.Stats`)
- Unused exports in main:
  - `opp_allows_entry`

Potential use:
- `opp_allows_entry` can simplify preview gating or enable/disable of entry overlays in the main file.

---

### tv_liquidity_engine.pine
Key exports (from attached file): `get_liquidity_tier`, `source_category_label`, `classify_sweep_type`, `compute_sweep_quality`, `get_sweep_grade`, `hierarchy_level_score`, `select_hierarchy_targets`, `summarize_active_sweeps`, `summarize_liquidity_map`
- Used directly in main:
  - `classify_sweep_type` ~1327
  - `compute_sweep_quality` ~1329, ~1421–1423
  - `get_sweep_grade` ~1330, ~1402, ~1423
  - `summarize_active_sweeps` ~1463
  - `summarize_liquidity_map` ~1473
  - `select_hierarchy_targets` ~1481
  - `get_liquidity_tier` is used indirectly via `tv_signal_gate_engine` and internally in this lib
- Unused exports in main:
  - `source_category_label`
  - `hierarchy_level_score` (used internally by `select_hierarchy_targets`)

Important discrepancy to flag:
- The main file calls these additional functions which are NOT present in the attached `tv_liquidity_engine.pine` version:
  - `liq.level_is_near(...)` at ~1074–1101
  - `liq.is_htf_liquidity_source(...)` at ~1388, ~3460, ~3465
  - `liq.source_phase_tag(...)` at ~1655, ~1790, ~1794
  These likely exist in a different revision of the library or under a different name. If you intend to rely on the lib for these, we should reconcile versions or add thin wrappers to this library.

Refactor opportunities:
- Where you compute source labels or tags in the main, consider `source_category_label` (unused) for consistent naming.

---

## Quick summary table (by library)
- tv_signal_gate_engine: no unused exports
- tv_render_utils: unused — `render_managed_box`, `render_managed_tag`, `render_historical_zone`, `delete_group`, `safe_delete_line`, `safe_delete_label`, `safe_delete_box`
- tv_readiness_ui: no unused exports
- tv_market_intel_ui: no unused exports
- tv_format_utils: unused — `format_dir`, `format_check`, `val_or_dash`, `str_or_dash`, `format_pct`, `format_r`, `format_age`
- tv_dashboard_utils: not used directly by main; indirectly used by UI libs; unused across provided set — `table_header`, `table_kv_emph`, `table_kv_muted`, `table_guidance`, `table_row3_emph`, `table_row3_muted`
- tv_entry_authority: unused — `assess_structural_validity`, `assess_execution_readiness`, `ea_allows_activation`, `ea_is_structurally_valid`
- tv_structure_engine: unused — `classify_mss_trigger`, `evaluate_break_quality`, `evaluate_mss_quality`
- tv_lifecycle_mode: unused — `lifecycle_is_terminal`, `lifecycle_action_text`, `mode_requires_retrace_for_activation`, `mode_requires_displacement`, `mode_requires_reclaim_proxy`, `pending_setup_is_fresh`, `format_action`
- tv_core_types: N/A (types/constants only)
- tv_pending_trade_state: unused — `opp_allows_entry`
- tv_liquidity_engine: unused — `source_category_label`, `hierarchy_level_score` (directly); note missing functions vs main: `level_is_near`, `is_htf_liquidity_source`, `source_phase_tag`

---

## Where you can swap local code for library calls in `version1-improving-dev.pine`
- Use `fmt.*` helpers for text formatting:
  - Direction and pass/fail chips: `format_dir`, `format_check`
  - N/A fallbacks: `val_or_dash`, `str_or_dash`
  - Percent and R metrics in performance: `format_pct`, `format_r`
  - Age strings for sweeps/MSS/FVG: `format_age`
- Use `ren.*` lifecycle helpers for persistent historical objects:
  - `render_historical_zone` or `render_managed_box`/`render_managed_tag` for past zones/OBs instead of manual `box.new` + updates
  - `delete_group`/`safe_delete_*` for centralized cleanup
- If you want lifecycle‑aware action text (instead of purely EA‑based):
  - `lm.format_action` can replace hand‑assembled “Action/Next Step” strings based on lifecycle + overrides
- When exposing MSS/disp quality details to UI:
  - `se.evaluate_mss_quality` (unused) is a compact gate you can surface without re‑deriving from stage outputs
- Candidate/preview gating:
  - `pts.opp_allows_entry` (unused) can standardize “is it okay to draw/act on this opportunity now?”
- Liquidity engine version alignment:
  - Since the main calls `liq.level_is_near`, `liq.is_htf_liquidity_source`, and `liq.source_phase_tag` which aren’t present in the attached `tv_liquidity_engine.pine`, reconcile versions or add wrappers with identical signatures to the library so the main relies solely on the lib for these checks/labels.

If you want, I can produce concrete diffs for `version1-improving-dev.pine` to replace local strings/logic with the above library functions, or help reconcile the `tv_liquidity_engine` version mismatch.