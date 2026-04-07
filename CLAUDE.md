# Kenko - Project Guidelines

## Date Management with MongoDB records

- CreatedAt and UpdatedAt on all records are for database audits only and should never be used for business logic. CreatedAt is set when a record is first created, and UpdatedAt is set whenever the record is updated. Both CreatedAt and UpdatedAt use a full timestamp value that is in utc with no timezone offset.
- Some records will record a duration, such as a workout session, that will record a startedAt and endedAt field. These always use a full timestamp in utc, but using the users timezone offset.

## Timezone & Date Storage

All dates stored in MongoDB use the user's timezone offset, not UTC midnight. The user's IANA timezone (e.g. `America/Los_Angeles`) is stored on their profile at `user.profile.timezone` and loaded into `locals.userTimezone` on every authenticated request via the auth hook.
