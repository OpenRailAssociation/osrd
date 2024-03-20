use crate::modelsv2::rolling_stock_model::{
    RollingStockModel, RollingStockSupportedSignalingSystems,
};
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::schema::rolling_stock::{RollingStock, RollingStockCommon, RollingStockWithLiveries};
use crate::schema::track_section::LoadingGaugeType;

crate::schemas! {
    RollingStock,
    RollingStockWithLiveries,
    LoadingGaugeType,
    RollingStockLiveryMetadata,
    RollingStockSupportedSignalingSystems,
}

impl From<RollingStockModel> for RollingStockCommon {
    fn from(rolling_stock_model: RollingStockModel) -> Self {
        RollingStockCommon {
            name: rolling_stock_model.name,
            effort_curves: rolling_stock_model.effort_curves,
            base_power_class: rolling_stock_model.base_power_class,
            length: rolling_stock_model.length,
            max_speed: rolling_stock_model.max_speed,
            startup_time: rolling_stock_model.startup_time,
            startup_acceleration: rolling_stock_model.startup_acceleration,
            comfort_acceleration: rolling_stock_model.comfort_acceleration,
            gamma: rolling_stock_model.gamma,
            inertia_coefficient: rolling_stock_model.inertia_coefficient,
            mass: rolling_stock_model.mass,
            rolling_resistance: rolling_stock_model.rolling_resistance,
            loading_gauge: rolling_stock_model.loading_gauge,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            electrical_power_startup_time: rolling_stock_model.electrical_power_startup_time,
            raise_pantograph_time: rolling_stock_model.raise_pantograph_time,
            supported_signaling_systems: rolling_stock_model.supported_signaling_systems,
        }
    }
}

impl From<RollingStockModel> for RollingStock {
    fn from(rolling_stock_model: RollingStockModel) -> Self {
        let rolling_stock_common: RollingStockCommon = rolling_stock_model.clone().into();
        RollingStock {
            id: rolling_stock_model.id,
            common: rolling_stock_common,
            railjson_version: rolling_stock_model.railjson_version,
            locked: rolling_stock_model.locked,
            metadata: rolling_stock_model.metadata,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use crate::error::InternalError;
    use crate::fixtures::tests::{
        db_pool, get_other_rolling_stock_form, named_fast_rolling_stock, named_other_rolling_stock,
    };
    use crate::modelsv2::Changeset;
    use crate::views::rolling_stocks::{map_diesel_error, RollingStockError};
    use crate::DbPool;
    use rstest::*;
    use serde_json::to_value;

    use super::RollingStockModel;
    use actix_web::web::Data;

    pub fn get_invalid_effort_curves() -> &'static str {
        include_str!("../../tests/example_rolling_stock_3.json")
    }

    #[rstest]
    async fn create_delete_rolling_stock(db_pool: Data<DbPool>) {
        use crate::modelsv2::Retrieve;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        let name = "fast_rolling_stock_create_delete_rolling_stock";
        let rolling_stock_id: i64;
        {
            let rolling_stock = named_fast_rolling_stock(name, db_pool.clone()).await;
            rolling_stock_id = rolling_stock.id();
            assert_eq!(name, rolling_stock.model.name.clone());
        }

        let rolling_stock = RollingStockModel::retrieve(&mut db_conn, rolling_stock_id)
            .await
            .unwrap();

        assert!(rolling_stock.is_none());
    }

    #[rstest]
    async fn update_rolling_stock(db_pool: Data<DbPool>) {
        use crate::modelsv2::Update;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        // GIVEN
        let other_rs_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock =
            named_fast_rolling_stock("fast_rolling_stock_update_rolling_stock", db_pool.clone())
                .await;
        let rolling_stock_id = rolling_stock.id();

        let updated_rolling_stock: Changeset<RollingStockModel> =
            get_other_rolling_stock_form(other_rs_name).into();
        // updated_rolling_stock.id = rolling_stock_id;

        // WHEN
        let updated_rolling_stock = updated_rolling_stock
            .update(&mut db_conn, rolling_stock_id)
            .await
            .unwrap()
            .unwrap();

        // THEN
        assert_eq!(updated_rolling_stock.name, other_rs_name);
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used(db_pool: Data<DbPool>) {
        use crate::modelsv2::*;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        // GIVEN
        let name = "fast_rolling_stock_update_rolling_stock_failure_name_already_used";
        let _rolling_stock = named_fast_rolling_stock(name, db_pool.clone()).await;
        let other_rolling_stock = named_other_rolling_stock(
            "other_rolling_stock_update_rolling_stock_failure_name_already_used",
            db_pool.clone(),
        )
        .await;

        let other_rolling_stock_id = other_rolling_stock.id();
        let mut other_rolling_stock =
            RollingStockModel::retrieve(&mut db_conn, other_rolling_stock_id)
                .await
                .unwrap()
                .unwrap();
        other_rolling_stock.name = name.to_string();

        // WHEN
        let result = other_rolling_stock
            .into_changeset()
            .update(&mut db_conn, other_rolling_stock_id)
            .await
            .map_err(|e| map_diesel_error(e, name));

        let error: InternalError = RollingStockError::NameAlreadyUsed {
            name: String::from(name),
        }
        .into();

        // THEN
        assert_eq!(
            to_value(result.unwrap_err()).unwrap(),
            to_value(error).unwrap()
        );
    }
}
