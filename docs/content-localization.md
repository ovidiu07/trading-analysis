# Content Localization (EN + RO)

## Locale resolution
- Frontend sends the current app language in `Accept-Language` on all API requests.
- Backend resolves locale from `lang` query param first, then `Accept-Language` header.
- Supported locales today: `en`, `ro`.
- Fallback: if requested translation is missing, API returns the `en` translation.
- Public content payloads (`/api/content`) also include a `translations` map (EN + RO) so the UI can switch language instantly without hard-refreshing the page.

## How to add a new content type + translations
1. Open **Admin -> Content -> Manage types** (`/admin/content/types`).
2. Click **Create type**.
3. Fill shared fields:
   - `key` in format `[A-Z0-9_]+` (example: `EARNINGS_RECAP`)
   - `sortOrder`
   - `active`
4. Fill EN translation (required):
   - `displayName`
   - `description` (optional)
5. Fill RO translation (recommended):
   - `displayName`
   - `description` (optional)
6. Save.

Result:
- Type is stored in `content_type`.
- Translations are stored in `content_type_translation`.
- Type labels on Insights/Admin resolve by current locale with EN fallback.

## How to translate an article
1. Open **Admin -> Content** and create/edit an article.
2. Fill shared fields:
   - Type
   - Slug
   - Tags/Symbols
   - Visibility window
   - Weekly range (for `WEEKLY_PLAN`)
3. Fill EN tab (required):
   - Title
   - Summary (optional)
   - Body (markdown)
4. Fill RO tab (optional but recommended):
   - Title
   - Summary
   - Body
5. If RO is empty, use **Copy EN to RO** and then adjust manually.
6. Save draft / Publish.

Result:
- Shared article metadata is stored in `content_post`.
- Localized fields are stored in `content_post_translation`.
- Public Insights uses locale-aware title/summary/body and type label.
- Missing RO automatically falls back to EN.

## API payload shapes (admin)

### Content type create/update
```json
{
  "key": "EARNINGS_RECAP",
  "active": true,
  "sortOrder": 100,
  "translations": {
    "en": { "displayName": "Earnings recap", "description": "..." },
    "ro": { "displayName": "Recap rezultate", "description": "..." }
  }
}
```

### Content post create/update
```json
{
  "contentTypeId": "<uuid>",
  "slug": "liquidity-order-block-playbook",
  "tags": ["liquidity", "playbook"],
  "symbols": ["AAPL", "SPX"],
  "visibleFrom": "2026-02-10T06:00:00Z",
  "visibleUntil": null,
  "translations": {
    "en": { "title": "...", "summary": "...", "body": "## ..." },
    "ro": { "title": "...", "summary": "...", "body": "## ..." }
  }
}
```
