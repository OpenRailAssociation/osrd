use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use editoast_models::DbConnection;
use editoast_schemas::infra::InfraObject;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;

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
    .execute(conn)
    .await
    .map(|idx| (idx, infra_object))
    .map_err(|err| err.into())
}

#[cfg(test)]
pub mod tests {
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::NeutralSection;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::TrackSection;
    use std::ops::DerefMut;

    macro_rules! test_create_object {
        ($obj:ident) => {
            paste::paste! {
                #[rstest::rstest]
                async fn [<test_create_ $obj:snake>]() {
                    let db_pool = editoast_models::DbConnectionPoolV2::for_tests();
                    let infra = crate::modelsv2::fixtures::create_empty_infra(db_pool.get_ok().deref_mut()).await;
                    let infra_object = editoast_schemas::infra::InfraObject::$obj {
                        railjson: $obj::default(),
                    };
                    let result = crate::infra_cache::operation::create::apply_create_operation(&infra_object, infra.id, db_pool.get_ok().deref_mut()).await;
                    assert!(result.is_ok(), "Failed to create a {}", stringify!($obj));
                }
            }
        };
    }

    test_create_object!(TrackSection);
    test_create_object!(Signal);
    test_create_object!(SpeedSection);
    test_create_object!(Switch);
    test_create_object!(Detector);
    test_create_object!(BufferStop);
    test_create_object!(Route);
    test_create_object!(OperationalPoint);
    test_create_object!(SwitchType);
    test_create_object!(Electrification);
    test_create_object!(NeutralSection);
}
