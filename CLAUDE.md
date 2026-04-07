# Kenko - Project Guidelines

## Date Management with MongoDB records

- CreatedAt and UpdatedAt on all records are for database audits only and should never be used for business logic. CreatedAt is set when a record is first created, and UpdatedAt is set whenever the record is updated. Both use plain UTC `new Date()`.
- Duration fields (startedAt, endedAt on workouts, fasts, etc.) are full UTC timestamps.
- There are no date-only fields. All date fields are full timestamps — date pickers are always paired with time pickers.

## Timezone & Date Storage

All dates are stored as native MongoDB Date objects (BSON UTC). The user's IANA timezone (e.g. `America/Los_Angeles`) is stored on their profile at `user.profile.timezone` and loaded into `locals.userTimezone` on every authenticated request via the auth hook.

### How dates flow

1. **Client sends full ISO datetimes with offset** — e.g. `2026-04-06T08:00:00.000-07:00`. Use `toDatetime(dateStr, timeStr, tz)` from `src/lib/dates.ts` to build these from date/time picker values.
2. **Server stores via `new Date(isoString)`** — the offset ensures the correct UTC instant is stored. MongoDB normalizes to UTC internally (e.g. `2026-04-06T15:00:00.000Z`). The offset is used for conversion, not preserved in storage.
3. **Server queries use `startOfDayTz`/`endOfDayTz`** from `src/lib/server/dates.ts` with `locals.userTimezone` for day/week boundaries.
4. **Display converts UTC back to the user's timezone** — `formatDate(iso, tz)` from `src/lib/format.ts` renders with date, time, and timezone abbreviation.

### Key rules

- Never use `new Date(dateStr + "T00:00:00.000Z")` for user-facing dates — this stores UTC midnight which is wrong for the user's timezone.
- Never pass timezone via cookies or URL query params — always read from `locals.userTimezone`.
- Components derive `tz` from `page.data.user?.profile?.timezone ?? "America/Los_Angeles"`.
- If a user changes their timezone (e.g. moves from Oregon to Colorado), existing timestamps display in the new timezone. The absolute moment is preserved; the local rendering shifts accordingly. This is expected and correct.

### Key files

- `src/lib/dates.ts` — Client-side helpers: `toDatetime()`, `localToday()`, `localTimeNow()`, `localDateStr()`, `localTimeStr()`
- `src/lib/server/dates.ts` — Server-side helpers: `todayStr()`, `startOfDayTz()`, `endOfDayTz()`, `startOfWeekTz()`, `endOfWeekTz()`
- `src/lib/format.ts` — Display helpers: `formatDate()`, `formatDateShort()`, `formatDateRange()`
- `src/hooks.server.ts` — Sets `locals.userTimezone` from user profile on every request
