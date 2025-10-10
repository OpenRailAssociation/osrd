use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::Arc;

use clap::Args;
use colored::Colorize as _;
use database::DbConnectionPoolV2;

use crate::models::RollingStock;
use editoast_models::TowedRollingStock;
use editoast_models::prelude::*;

#[derive(Args, Clone, Debug)]
#[command(about, long_about = "Import a rolling stock given a json file")]
pub struct ImportRollingStockArgs {
    /// Rolling stock file path
    rolling_stock_path: Vec<PathBuf>,

    /// If true, force the update of the rolling stock if it already exists
    #[clap(long, default_value_t = false)]
    pub force: bool,
}

pub async fn import_rolling_stock(
    args: ImportRollingStockArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    for rolling_stock_path in args.rolling_stock_path {
        let mut conn = db_pool.get().await?;
        let rolling_stock_file = File::open(rolling_stock_path)?;
        let rolling_stock: schemas::RollingStock =
            serde_json::from_reader(BufReader::new(rolling_stock_file))?;
        let rolling_stock_name = rolling_stock.name.clone();
        let rolling_stock: Changeset<RollingStock> = rolling_stock.into();

        println!(
            "🍞 Importing rolling stock {}",
            rolling_stock
                .name
                .as_deref()
                .unwrap_or("rolling stock without name")
                .bold()
        );
        let existing_rolling_stock =
            RollingStock::retrieve(conn.clone(), rolling_stock_name.clone()).await?;
        match (existing_rolling_stock, args.force) {
            (Some(_), true) => {
                let rolling_stock = rolling_stock
                    .locked(false)
                    .version(0)
                    .update(&mut conn, rolling_stock_name.clone())
                    .await?
                    .unwrap();
                println!(
                    "   ↳ ✅ Rolling stock {}[{}] saved! (forced update)",
                    &rolling_stock_name.bold(),
                    &rolling_stock.id,
                );
            }
            (Some(existing_rolling_stock), false) => {
                println!(
                    "   ↳ ⚠️  Rolling stock {}[{}] already existing! (try use \"--force\" to update it)",
                    &rolling_stock_name.bold(),
                    &existing_rolling_stock.id,
                );
            }
            _ => {
                let rolling_stock = rolling_stock
                    .locked(false)
                    .version(0)
                    .create(&mut conn)
                    .await?;
                println!(
                    "   ↳ ✅ Rolling stock {}[{}] saved!",
                    &rolling_stock_name.bold(),
                    &rolling_stock.id,
                );
            }
        };
    }
    Ok(())
}

pub async fn import_towed_rolling_stock(
    args: ImportRollingStockArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    for towed_rolling_stock_path in args.rolling_stock_path {
        let towed_rolling_stock_file = File::open(towed_rolling_stock_path)?;
        let towed_rolling_stock: schemas::TowedRollingStock =
            serde_json::from_reader(BufReader::new(towed_rolling_stock_file))?;
        let towed_rolling_stock: Changeset<TowedRollingStock> = towed_rolling_stock.into();
        println!(
            "🍞 Importing towed rolling stock {}",
            towed_rolling_stock
                .name
                .as_deref()
                .unwrap_or("towed rolling stock without name")
                .bold()
        );
        let towed_rolling_stock = towed_rolling_stock
            .locked(false)
            .version(0)
            .create(&mut db_pool.get().await?)
            .await?;
        println!(
            "✅ Towed rolling stock {}[{}] saved!",
            &towed_rolling_stock.name.bold(),
            &towed_rolling_stock.id
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    mod rolling_stock {
        use super::*;

        use crate::client::generate_temp_file;

        use common::units;
        use database::DbConnectionPoolV2;

        fn get_fast_rolling_stock_schema(name: &str) -> schemas::RollingStock {
            let mut rolling_stock_form: schemas::RollingStock =
                serde_json::from_str(include_str!("../tests/example_rolling_stock_1.json"))
                    .expect("Unable to parse");
            rolling_stock_form.name = name.to_string();
            rolling_stock_form
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_rolling_stock_ko_file_not_found() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec!["non/existing/railjson/file/location".into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.into()).await;

            // THEN
            assert!(result.is_err())
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_non_electric_rs_without_startup_and_panto_values() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let rolling_stock_name =
                "fast_rolling_stock_import_non_electric_rs_without_startup_and_panto_values";
            let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
            non_electric_rs.effort_curves.modes.remove("25000V");

            let file = generate_temp_file(&non_electric_rs);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(
                result.is_ok(),
                "import should succeed, as raise_panto and startup are not required for non electric",
            );
            let created_rs =
                RollingStock::retrieve(db_pool.get_ok(), rolling_stock_name.to_string())
                    .await
                    .unwrap();
            assert!(created_rs.is_some());
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_non_electric_rs_with_startup_and_panto_values() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let rolling_stock_name =
                "fast_rolling_stock_import_non_electric_rs_with_startup_and_panto_values";
            let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
            non_electric_rs.effort_curves.modes.remove("25000V");

            let file = generate_temp_file(&non_electric_rs);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(result.is_ok(), "import should succeed");
            let created_rs =
                RollingStock::retrieve(db_pool.get_ok(), rolling_stock_name.to_string())
                    .await
                    .expect("failed to retrieve rolling stock")
                    .unwrap();
            let RollingStock {
                electrical_power_startup_time,
                raise_pantograph_time,
                ..
            } = created_rs;
            assert!(electrical_power_startup_time.is_some());
            assert!(raise_pantograph_time.is_some());
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_electric_rs_without_startup_and_panto_values() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let rolling_stock_name =
                "fast_rolling_stock_import_electric_rs_without_startup_and_panto_values";
            let mut electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
            electric_rs.raise_pantograph_time = None;
            electric_rs.electrical_power_startup_time = None;
            let file = generate_temp_file(&electric_rs);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(
                result.is_err(),
                "import should fail, as raise_panto and startup are required for electric"
            );
            let created_rs =
                RollingStock::retrieve(db_pool.get_ok(), rolling_stock_name.to_string())
                    .await
                    .unwrap();
            assert!(created_rs.is_none());
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_electric_rs_with_startup_and_panto_values() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let rolling_stock_name =
                "fast_rolling_stock_import_electric_rs_with_startup_and_panto_values";
            let electric_rolling_stock = get_fast_rolling_stock_schema(rolling_stock_name);
            let file = generate_temp_file(&electric_rolling_stock);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(result.is_ok(), "import should succeed");
            let created_rs =
                RollingStock::retrieve(db_pool.get_ok(), rolling_stock_name.to_string())
                    .await
                    .expect("Failed to retrieve rolling stock")
                    .unwrap();
            let RollingStock {
                electrical_power_startup_time,
                raise_pantograph_time,
                ..
            } = created_rs;
            assert!(electrical_power_startup_time.is_some());
            assert!(raise_pantograph_time.is_some());
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_existing_rolling_stock_without_force() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let existing_rolling_stock_name = "existing_rolling_stock";
            let existing_rolling_stock_form =
                get_fast_rolling_stock_schema(existing_rolling_stock_name);

            let existing_rolling_stock: Changeset<RollingStock> =
                existing_rolling_stock_form.clone().into();
            existing_rolling_stock
                .locked(false)
                .version(0)
                .create(&mut db_pool.get_ok())
                .await
                .unwrap();

            // second rolling stock with same values except length (100.0 instead of 400.0)
            let mut updated_rolling_stock_form = existing_rolling_stock_form.clone();
            updated_rolling_stock_form.length = units::meter::new(100.0);
            let file = generate_temp_file(&updated_rolling_stock_form);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(
                result.is_ok(),
                "import should succeed, but result as skipped, as a rolling stock already exists and --force is disabled"
            );
            let rolling_stock =
                RollingStock::retrieve(db_pool.get_ok(), existing_rolling_stock_name.to_string())
                    .await
                    .unwrap();
            assert!(rolling_stock.is_some());
            assert!(rolling_stock.unwrap().length == units::meter::new(400.0));
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_existing_rolling_stock_with_force() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let existing_rolling_stock_name = "existing_rolling_stock";
            let existing_rolling_stock_form =
                get_fast_rolling_stock_schema(existing_rolling_stock_name);
            let existing_rolling_stock: Changeset<RollingStock> =
                existing_rolling_stock_form.clone().into();
            existing_rolling_stock
                .locked(false)
                .version(0)
                .create(&mut db_pool.get_ok())
                .await
                .unwrap();

            // second rolling stock with same values except length (100.0 instead of 400.0)
            let mut updated_rolling_stock_form = existing_rolling_stock_form.clone();
            updated_rolling_stock_form.length = units::meter::new(100.0);
            let file = generate_temp_file(&updated_rolling_stock_form);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: true,
            };

            // WHEN
            let result = import_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(
                result.is_ok(),
                "import should succeed, but result as skipped, as a rolling stock already exists and --force is disabled"
            );
            let rolling_stock =
                RollingStock::retrieve(db_pool.get_ok(), existing_rolling_stock_name.to_string())
                    .await
                    .unwrap();
            assert!(rolling_stock.is_some());
            assert!(rolling_stock.unwrap().length == units::meter::new(100.0));
        }
    }

    mod towed_rolling_stock {
        use super::*;

        use crate::client::generate_temp_file;

        use database::DbConnectionPoolV2;

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_towed_rolling_stock_ko_file_not_found() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec!["non/existing/railjson/file/location".into()],
                force: false,
            };

            // WHEN
            let result = import_towed_rolling_stock(args, db_pool.into()).await;

            // THEN
            assert!(result.is_err())
        }

        #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
        async fn import_valid_towed_rolling_stock() {
            // GIVEN
            let db_pool = DbConnectionPoolV2::for_tests();
            let db_pool = Arc::new(db_pool);
            let towed_rolling_stock_name = "towed";
            let mut towed_rolling_stock_form: schemas::TowedRollingStock =
                serde_json::from_str(include_str!("../tests/example_towed_rolling_stock_1.json"))
                    .expect("Unable to parse");
            towed_rolling_stock_form.name = towed_rolling_stock_name.to_string();

            let file = generate_temp_file(&towed_rolling_stock_form);
            let args = ImportRollingStockArgs {
                rolling_stock_path: vec![file.path().into()],
                force: false,
            };

            // WHEN
            let result = import_towed_rolling_stock(args, db_pool.clone()).await;

            // THEN
            assert!(result.is_ok());
            let created_rs =
                TowedRollingStock::retrieve(db_pool.get_ok(), towed_rolling_stock_name.to_string())
                    .await
                    .unwrap();
            assert!(created_rs.is_some());
        }
    }
}
