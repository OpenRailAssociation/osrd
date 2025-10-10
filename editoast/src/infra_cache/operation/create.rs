use database::DbConnection;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use schemas::infra::InfraObject;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDObject;
use std::ops::DerefMut;

use super::OperationError;
use crate::error::Result;
use crate::models::get_table;

pub async fn apply_create_operation<'r>(
    infra_object: &'r InfraObject,
    infra_id: i64,
    conn: &mut DbConnection,
) -> Result<(usize, &'r InfraObject)> {
    if infra_object.get_id().is_empty() {
        return Err(OperationError::EmptyId.into());
    }
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        get_table(&infra_object.get_type())
    ))
    .bind::<BigInt, _>(infra_id)
    .bind::<Text, _>(infra_object.get_id())
    .bind::<Json, _>(infra_object.get_data())
    .execute(conn.write().await.deref_mut())
    .await
    .map(|idx| (idx, infra_object))
    .map_err(|err| err.into())
}

#[cfg(test)]
pub mod tests {
    use schemas::infra::BufferStop;
    use schemas::infra::Detector;
    use schemas::infra::Electrification;
    use schemas::infra::NeutralSection;
    use schemas::infra::OperationalPoint;
    use schemas::infra::Route;
    use schemas::infra::Signal;
    use schemas::infra::SpeedSection;
    use schemas::infra::Switch;
    use schemas::infra::SwitchType;
    use schemas::infra::TrackSection;

    macro_rules! test_create_object {
        ($obj:ident, $test_fn:ident) => {
            #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
            async fn $test_fn() {
                let db_pool = database::DbConnectionPoolV2::for_tests();
                let infra =
                    crate::models::fixtures::create_empty_infra(&mut db_pool.get_ok()).await;
                let infra_object = schemas::infra::InfraObject::$obj {
                    railjson: $obj::default(),
                };
                let result = crate::infra_cache::operation::create::apply_create_operation(
                    &infra_object,
                    infra.id,
                    &mut db_pool.get_ok(),
                )
                .await;
                assert!(result.is_ok(), "Failed to create a {}", stringify!($obj));
            }
        };
    }

    test_create_object!(TrackSection, test_create_track_section);
    test_create_object!(Signal, test_create_signal);
    test_create_object!(SpeedSection, test_create_speed_section);
    test_create_object!(Switch, test_create_switch);
    test_create_object!(Detector, test_create_detector);
    test_create_object!(BufferStop, test_create_buffer_stop);
    test_create_object!(Route, test_create_route);
    test_create_object!(OperationalPoint, test_create_operational_point);
    test_create_object!(SwitchType, test_create_switch_type);
    test_create_object!(Electrification, test_create_electrification);
    test_create_object!(NeutralSection, test_create_neutral_section);
}
