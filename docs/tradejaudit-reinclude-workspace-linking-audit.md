# TradeJAudit re-inclusion and workspace-linking audit

## Pre-implementation findings

1. **Why an excluded trade cannot be re-included**
   `LiveTradeEvidenceSyncService.synchronize` returns immediately whenever the existing evidence link has `syncStatus = EXCLUDED`, and `retry` explicitly rejects excluded evidence. The update endpoint can set exclusion but has no inverse command that clears it and re-runs matching. The Research Inbox also hides all actions except classification for excluded evidence.

2. **Why GER40 and DAX are incompatible today**
   Exact matching uppercases both values, removes non-alphanumeric characters, and compares the remaining raw tokens. It does not resolve instrument aliases, so `GER40` remains `GER40` and `DAX` remains `DAX`.

3. **Whether the reported strategy matches**
   Workspace matching requires the live trade's `strategyId` to equal the workspace's linked strategy ID. The reported workspace is linked to `Liquidity setup`, but the observed trade summary does not expose its strategy, so the match cannot be confirmed from the reported UI. The current UI also gives no strategy-specific mismatch explanation.

4. **Whether classification blocks linking**
   It does not. Classification status is stored independently, and synchronization can set `SYNCED` plus `includedInAnalytics = true` while classification remains `NEEDS_CLASSIFICATION` or `PARTIAL`. The inbox deliberately retains synchronized evidence until classification is complete.

5. **Whether exclusion is reversible in the evidence model**
   The record is preserved, including its live-trade ID, workspace link, classification JSON, snapshot fields, screenshot count, and notes. The database already enforces one evidence record per `(user_id, live_trade_id)`. The stored data can therefore support reversal without duplication, but the service and UI do not currently provide the state transition.

## Integrity and authorization gaps found

- The generic evidence update endpoint accepts any owned workspace without checking whether it is active, accepts live evidence, or is compatible.
- Setting a workspace before processing `includedInAnalytics` can effectively bypass the excluded-state guard through the API.
- The picker lists workspaces without per-rule compatibility or mismatch details.
- The UI sends a localized exclusion sentence to the database instead of a stable reason code.
