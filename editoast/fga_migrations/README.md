# CLI program that runs Openfga migrations

## Usage

### Add a new migration

1. Write the model of the new migration in the migrations folder (`./editoast/fga_migrations/migrations/`) in the DSL format ([related OpenFGA documentation](https://openfga.dev/docs/getting-started/configure-model). The migration filename should follow that format : `MIGRATION_NUMBER_MIGRATION_NAME.fga`.
2. Execute the migration using the `fga_migrations` crate binary: `cargo run -- apply` or `cargo run -- apply [MIGRATION_NAME]` at the `fga_migrations` crate root, or `(cd fga_migrations && cargo run -- apply)` from the workspace root. For more information on the binary ClI: `cargo run -- --help` (`(cd fga_migrations && cargo run -- --help)` from the workspace root).

### Revert a migration

Migrations are not applied sequentially yet (see explanations in the clarifications secetion below). To revert the migration `n`, apply the previous migration: `cargo run -- apply PREVIOUS_MIGRATION_NAME`.

## Caveats

- An openfga migration run run hangs indefinitely: make sure `FGA_API_URL` is set correctly. `fga_migrations` and the `fga` crate both use the `fga` CLI binary to compile a migration defined in openfga DSL format into json before sending it to the openfga server. The binary hangs indefinitely if the api url provided to it is not set correctly.

## Clarifications on openfga migrations and their current implementation the crate

- The crate only allows to migrate authorization models for the moment: tuple migrations will come later.
- Applying a migration means pushing its related authorization model to the openfga authorization store and making if the default one. It does not delete the previous models: openfga does not allow to do that. It does not alter previous models either, as openfga models are immutable.
- Rolling back to the migration `n`, applying the migration `n` and running the migrations up to the migration `n` are currently the same thing, as there are no tuples to migrate.

More information about openfga model migrations can be found in [openfga official documentation](https://openfga.dev/docs/modeling/migrating/migrating-models).
