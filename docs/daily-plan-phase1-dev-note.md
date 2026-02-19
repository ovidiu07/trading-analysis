# Daily Plan Phase 1 — Developer Note

## TradingView symbol for GER40 / DAX
- In Admin Content Editor (`DAILY_PLAN`), open **Chart** and set **TradingView symbol**.
- Common examples that work in TradingView:
  - `TVC:DAX`
  - `XETR:DAX`
- If a broker-specific symbol is preferred, use that exact TradingView symbol and verify it in the Today page widget.
- Optional chart settings:
  - Interval: `1`, `3`, `5`, `15`, `30`, `60`, `240`, `D`, `W`
  - Theme: `SYSTEM`, `LIGHT`, `DARK`
  - Hide controls / Allow symbol change toggles

## Setting or replacing the snapshot
- In Admin Content Editor (`DAILY_PLAN`), upload an image in **Assets** or reuse an existing image asset.
- Click **Set as chart snapshot** on the image.
- (Optional) Fill **Snapshot caption**.
- To replace it, click **Set as chart snapshot** on another image.
- If the currently selected snapshot asset is removed, snapshot reference and caption are cleared automatically.

## Added fields and backward compatibility
- `content_post` new nullable fields:
  - `trading_view_symbol`
  - `trading_view_interval`
  - `trading_view_theme`
  - `trading_view_hide_controls`
  - `trading_view_allow_symbol_change`
  - `snapshot_asset_id`
  - `snapshot_caption`
- `trades` new nullable field:
  - `initial_notes`
- Backward compatibility:
  - Existing Daily Plans remain valid with null chart/snapshot fields.
  - Existing assets model is unchanged; snapshot is a reference to one asset.
  - Existing Start Trade payloads using `notes` still work (mapped as fallback to `initialNotes`).
