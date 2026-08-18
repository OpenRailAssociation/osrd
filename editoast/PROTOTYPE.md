# SeaORM and SQLx migration prototype

Status: planning  
Last updated: 2026-08-19

## Purpose

Build a small Rust project that answers the migration's uncertain integration questions before production work begins. The prototype is evidence only; it must not grow into a second application or a reusable abstraction layer.

## Repository and database isolation

Create the project outside the `osrd` repository, for example at `<parent-of-osrd>/seaorm-migration-prototype`. Initialize it as a separate Jujutsu repository.

- Keep exactly one revision per numbered task below.
- Rewrite or reorder revisions when that improves reviewability, but do not squash them.
- Commit the task's code, tests, and `RESULTS.md` update in the same revision.
- Use a dedicated PostgreSQL database named or prefixed `seaorm_migration_prototype`; never connect the prototype to an `osrd` development, test, template, or deployment database.
- Use the same PostgreSQL major version and PostGIS extension as Editoast.

Use `sea-orm = "2.0"`, the compatible SQLx and `sqlx-cli` versions, Tokio, and only the libraries required by the six tasks. Keep one small migration, a few hand-written entities, focused integration tests, checked SQLx metadata, and a concise `RESULTS.md`.

## Revision 1 — dependencies, pool, transactions, and offline build

Create one SQLx `PgPool`, wrap it with `SqlxPostgresConnector::from_sqlx_postgres_pool`, and run one SeaORM query and one independent checked SQLx query. Add one SeaORM-only rollback test and one SQLx-only rollback test; do not mix the stacks in a transaction. Prepare SQLx offline metadata.

Acceptance criteria:

- SeaORM 2, direct SQLx, and `sqlx-cli` resolve to compatible versions recorded in `Cargo.lock` and `RESULTS.md`;
- both interfaces use the same pool;
- both rollback tests pass without reacquiring from the pool inside a transaction;
- the project builds without `DATABASE_URL` from checked-in metadata.

## Revision 2 — representative custom values

Add only the representative local types needed to test a primitive-backed unit, typed JSON, an `i16` enum, a PostgreSQL enum, and an array that flattens null elements.

Acceptance criteria:

- SeaORM insert/select/update round trips preserve each public Rust value;
- checked SQLx queries use the same value or a small explicit adapter;
- invalid numeric enum values return an error;
- a null array element is discarded on read, and writes never create null elements;
- the implementation does not introduce a generic model or CRUD abstraction.

## Revision 3 — PostgreSQL intervals

Implement the smallest local interval value needed by `train_schedule`. Test `NULL`, zero, positive and negative microseconds/days/months, one mixed value, one duration longer than a day, and one overflow case.

Acceptance criteria:

- one PostgreSQL month decodes as 30 days, matching Diesel;
- mixed values use checked `months * 30 days + days + microseconds` arithmetic;
- overflow returns a typed error and never panics;
- Rust writes use `months = 0` and round trip through the selected production-shaped path;
- if month-compatible conversion cannot be made safe, `RESULTS.md` instead records the exact zero-month deployment preflight and its failure behavior.

## Revision 4 — PostGIS boundary

Store and load one point and one line with the production SRID using WKB, and keep one GeoJSON query as a control.

Acceptance criteria:

- geometry kind and coordinates survive the round trip;
- SRID is read and restored explicitly;
- the GeoJSON control is unchanged;
- no generic SeaORM geometry value type is introduced.

## Revision 5 — test database ownership and template key

Implement a cloneable `Db` backed by `Arc<DbInner>`. The final drop schedules exactly one cleanup job on a worker independent of the creating Tokio runtime; there is no public close method. Name template databases from a bounded hash of every ordered migration's version, type, and complete bytes plus the complete initialization SQL.

Acceptance criteria:

- `Db::for_tests().await` never blocks an executor thread;
- non-final drops do nothing and the final drop removes the dedicated test database once;
- cleanup completes after the creating runtime stops;
- ten parallel create/drop tests leave no prototype databases behind;
- changing any migration input or the initialization SQL changes the template name;
- process termination bypassing `Drop` is recorded as a known limitation.

## Revision 6 — TLS, errors, and logging

Configure the intended PostgreSQL TLS behavior, provoke one unique, check, and foreign-key violation, and enable SeaORM `debug-print` through `tracing`. Disable duplicate SQLx statement logging.

Acceptance criteria:

- TLS success and failure match the current Editoast policy;
- SQLSTATE and constraint details remain accessible for all three errors;
- SeaORM query events, including interpolated values, reach the configured subscriber once;
- `RESULTS.md` records the final dependency versions and the selected implementation for every task.

## Completion gate

The prototype is complete when all six revisions satisfy their acceptance criteria, `cargo test` passes against only the dedicated prototype database, and a clean offline build passes without `DATABASE_URL`.
