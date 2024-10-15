use std::path::PathBuf;
use std::{error::Error, fs::File, io::BufReader, sync::Arc};

use clap::Args;
use colored::Colorize as _;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::rolling_stock::RollingStock;
use validator::ValidationErrorsKind;

use crate::models::prelude::*;
use crate::{models::RollingStockModel, CliError};

#[derive(Args, Debug)]
#[command(about, long_about = "Import a rolling stock given a json file")]
pub struct ImportRollingStockArgs {
    /// Rolling stock file path
    rolling_stock_path: Vec<PathBuf>,
}

pub async fn import_rolling_stock(
    args: ImportRollingStockArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for rolling_stock_path in args.rolling_stock_path {
        let rolling_stock_file = File::open(rolling_stock_path)?;
        let rolling_stock_form: RollingStock =
            serde_json::from_reader(BufReader::new(rolling_stock_file))?;
        let rolling_stock: Changeset<RollingStockModel> = rolling_stock_form.into();
        match rolling_stock.validate_imported_rolling_stock() {
            Ok(()) => {
                println!(
                    "🍞 Importing rolling stock {}",
                    rolling_stock
                        .name
                        .as_ref()
                        .map(|n| n.bold())
                        .unwrap_or("rolling stock witout name".bold())
                );
                let rolling_stock = rolling_stock
                    .locked(false)
                    .version(0)
                    .create(&mut db_pool.get().await?)
                    .await?;
                println!(
                    "✅ Rolling stock {}[{}] saved!",
                    &rolling_stock.name.bold(),
                    &rolling_stock.id
                );
            }
            Err(e) => {
                let mut error_message = "❌ Rolling stock was not created!".to_string();
                if let Some(ValidationErrorsKind::Field(field_errors)) = e.errors().get("__all__") {
                    for error in field_errors {
                        if &error.code == "electrical_power_startup_time" {
                            error_message.push_str(
                                "\nRolling stock is electrical, but electrical_power_startup_time is missing"
                            );
                        }
                        if &error.code == "raise_pantograph_time" {
                            error_message.push_str(
                                "\nRolling stock is electrical, but raise_pantograph_time is missing"
                            );
                        }
                    }
                }
                return Err(Box::new(CliError::new(2, error_message)));
            }
        };
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::client::generate_temp_file;
    use crate::models::RollingStockModel;

    use editoast_models::DbConnectionPoolV2;
    use rstest::rstest;

    fn get_fast_rolling_stock_schema(name: &str) -> RollingStock {
        let mut rolling_stock_form: RollingStock =
            serde_json::from_str(include_str!("../tests/example_rolling_stock_1.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = name.to_string();
        rolling_stock_form
    }

    #[rstest]
    async fn import_rolling_stock_ko_file_not_found() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec!["non/existing/railjson/file/location".into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.into()).await;

        // THEN
        assert!(result.is_err())
    }

    #[rstest]
    async fn import_non_electric_rs_without_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_without_startup_and_panto_values";
        let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        non_electric_rs.effort_curves.modes.remove("25000V");

        let file = generate_temp_file(&non_electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(
            result.is_ok(),
            "import should succeed, as raise_panto and startup are not required for non electric",
        );
        use crate::models::Retrieve;
        let created_rs =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_some());
    }

    #[rstest]
    async fn import_non_electric_rs_with_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_with_startup_and_panto_values";
        let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        non_electric_rs.effort_curves.modes.remove("25000V");

        let file = generate_temp_file(&non_electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(result.is_ok(), "import should succeed");
        use crate::models::Retrieve;
        let created_rs =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), rolling_stock_name.to_string())
                .await
                .expect("failed to retrieve rolling stock")
                .unwrap();
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = created_rs;
        assert!(electrical_power_startup_time.is_some());
        assert!(raise_pantograph_time.is_some());
    }

    #[rstest]
    async fn import_electric_rs_without_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_without_startup_and_panto_values";
        let mut electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        electric_rs.raise_pantograph_time = None;
        electric_rs.electrical_power_startup_time = None;
        let file = generate_temp_file(&electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(
            result.is_err(),
            "import should fail, as raise_panto and startup are required for electric"
        );
        use crate::models::Retrieve;
        let created_rs =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_none());
    }

    #[rstest]
    async fn import_electric_rs_with_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_with_startup_and_panto_values";
        let electric_rolling_stock = get_fast_rolling_stock_schema(rolling_stock_name);
        let file = generate_temp_file(&electric_rolling_stock);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(result.is_ok(), "import should succeed");
        use crate::models::Retrieve;
        let created_rs =
            RollingStockModel::retrieve(&mut db_pool.get_ok(), rolling_stock_name.to_string())
                .await
                .expect("Failed to retrieve rolling stock")
                .unwrap();
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = created_rs;
        assert!(electrical_power_startup_time.is_some());
        assert!(raise_pantograph_time.is_some());
    }
}
