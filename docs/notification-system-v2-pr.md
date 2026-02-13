# Notification System v2

## Discovery (Step 0)

- Content entity + localized fields:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/domain/entity/ContentPost.java`
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/domain/entity/ContentPostTranslation.java`
  - `ContentPost` already had `slug`, `status` (`DRAFT|PUBLISHED|ARCHIVED`), `visibleFrom`, `visibleUntil`, `tags`, `symbols`, `updatedAt`.
  - EN/RO content is stored in `content_post_translation` rows keyed by locale.
- Category/type model:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/domain/entity/ContentType.java`
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/domain/entity/ContentTypeTranslation.java`
  - Admin “Type” is `content_type_id` (UUID); localized labels come from `content_type_translation`.
  - Type/category is reused as notification category.
- Publish + update hooks:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/ContentPostService.java`
  - Publish flow: `publish(UUID id, String locale)`
  - Update flow for existing content: `update(UUID id, ContentPostRequest request, String locale)`
  - Slug generation happens in `applyRequest(...)` via `normalizeSlug(...)` + `ensureUniqueSlug(...)`.
  - `updatedAt` already existed via `@UpdateTimestamp`.
- Insights routing:
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/App.tsx`
  - Detail route is `/insights/:idOrSlug` (no SPA route variant for `/en/...` or `/ro/...`).
- Header/bell insertion point:
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/layout/TopBar.tsx`
  - Language/theme/profile controls are here; bell icon was added in this area.

## Architecture

- Added event-driven notification model:
  - Broadcast event table: `notification_event`
  - Per-user state table: `user_notification`
  - Per-user preferences table: `notification_preferences`
  - Migration: `/Users/ovidiu/Documents/trading-analysis/backend/src/main/resources/db/migration/V14__notifications.sql`
- Added `content_version` on `content_post` for update dedupe and spam control.
- Event generation lives in:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/notification/NotificationEventService.java`
  - Triggered from publish/update flow in `ContentPostService`.
- Dispatch pipeline:
  - Async after-commit immediate dispatch for due events.
  - Scheduled dispatcher for pending future events.
  - Batched insert-select for matching users by preferences.
  - Files:
    - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/notification/NotificationDispatchService.java`
    - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/notification/NotificationDispatchScheduler.java`
    - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/repository/UserNotificationRepository.java`
- Real-time delivery:
  - SSE endpoint `/api/notifications/stream`
  - SSE broadcaster:
    - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/notification/NotificationStreamService.java`
  - Frontend uses streaming fetch parser + polling fallback:
    - `/Users/ovidiu/Documents/trading-analysis/frontend/src/features/notifications/NotificationsContext.tsx`
- API surface:
  - Notifications:
    - `GET /api/notifications`
    - `GET /api/notifications/unread-count`
    - `POST /api/notifications/{id}/read`
    - `POST /api/notifications/read-all`
    - `GET /api/notifications/stream`
  - Preferences:
    - `GET /api/notification-preferences`
    - `PUT /api/notification-preferences`
  - Categories:
    - `GET /api/content-categories`

## Performance Notes

- Dispatch avoids per-user synchronous loops in publish/update requests.
- User notification fan-out is done with a single batched SQL `INSERT ... SELECT` filtered by preferences.
- Pending events are processed in scheduler batches (`notifications.dispatch.fixed-delay-ms` configurable).
- SSE connections are kept lightweight with heartbeat events; frontend falls back to polling when stream is unavailable.

## QA Checklist

- [ ] Publish visible now creates `CONTENT_PUBLISHED`, dispatches immediately to matching users.
- [ ] Publish with future `visibleFrom` creates event with future `effectiveAt` and dispatches after scheduler window.
- [ ] Published content meaningful update + toggle ON creates `CONTENT_UPDATED`.
- [ ] Published content meaningful update + toggle OFF updates content but does not create `CONTENT_UPDATED`.
- [ ] `content_version` increments on publish and meaningful published updates.
- [ ] `content_version` dedupe prevents duplicate update events per version.
- [ ] Preferences `ALL` vs `SELECTED` category filtering works as expected.
- [ ] Bell badge updates from SSE without page refresh.
- [ ] Polling fallback updates unread count if SSE drops.
- [ ] Clicking notification marks as read and routes to `/insights/:slug`.
- [ ] Notification settings persist and affect future dispatch.
- [ ] EN/RO strings render correctly for bell/settings/toasts.

## Changed Flow Hooks

- Publish hook:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/ContentPostService.java#L135`
- Published update hook + meaningful detection:
  - `/Users/ovidiu/Documents/trading-analysis/backend/src/main/java/com/tradevault/service/ContentPostService.java#L113`
- Admin update toggle (frontend):
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/pages/admin/AdminContentEditorPage.tsx`
- Header bell + panel:
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/layout/TopBar.tsx`
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/components/layout/NotificationBell.tsx`
- Settings notifications UI:
  - `/Users/ovidiu/Documents/trading-analysis/frontend/src/pages/SettingsPage.tsx`
