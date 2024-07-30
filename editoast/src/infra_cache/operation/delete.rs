use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(deny_unknown_fields)]
/// A delete operation. Contains same information as a object ref but has another serialization.
pub struct DeleteOperation {
    pub obj_id: String,
    pub obj_type: ObjectType,
}

impl DeleteOperation {
    pub async fn apply(&self, infra_id: i64, conn: &mut DbConnection) -> Result<()> {
        match sql_query(format!(
            "DELETE FROM {} WHERE obj_id = $1 AND infra_id = $2",
            get_table(&self.obj_type)
        ))
        .bind::<Text, _>(&self.obj_id)
        .bind::<BigInt, _>(&infra_id)
        .execute(conn)
        .await
        {
            Ok(1) => Ok(()),
            Ok(_) => Err(OperationError::ObjectNotFound {
                obj_id: self.obj_id.clone(),
                infra_id,
            }
            .into()),
            Err(err) => Err(err.into()),
        }
    }
}

impl From<DeleteOperation> for ObjectRef {
    fn from(del_op: DeleteOperation) -> Self {
        Self {
            obj_id: del_op.obj_id,
            obj_type: del_op.obj_type,
        }
    }
}

impl From<ObjectRef> for DeleteOperation {
    fn from(obj_ref: ObjectRef) -> Self {
        Self {
            obj_id: obj_ref.obj_id,
            obj_type: obj_ref.obj_type,
        }
    }
}

#[cfg(test)]
mod tests {
    use diesel::sql_types::BigInt;

    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::NeutralSection;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::TrackNode;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::primitives::OSRDIdentified;
    use editoast_schemas::primitives::OSRDObject;

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    macro_rules! test_delete_object {
        ($obj:ident) => {
            paste::paste! {
                #[rstest::rstest]
                async fn [<test_delete_$obj:snake>]() {
                    use diesel_async::RunQueryDsl;
                    use std::ops::DerefMut;

                    let db_pool = DbConnectionPoolV2::for_tests();
                    let infra = crate::modelsv2::fixtures::create_empty_infra(db_pool.get_ok().deref_mut()).await;

                    let railjson_object = editoast_schemas::infra::InfraObject::$obj {
                        railjson: $obj::default(),
                    };
                    let result = crate::infra_cache::operation::create::apply_create_operation(&railjson_object, infra.id, db_pool.get_ok().deref_mut()).await;
                    assert!(result.is_ok(), "Failed to create a {}", stringify!($obj));

                    let object_deletion: crate::infra_cache::operation::delete::DeleteOperation = railjson_object.get_ref().into();
                    let result = object_deletion.apply(infra.id, db_pool.get_ok().deref_mut()).await;
                    assert!(result.is_ok(), "Failed to delete a {}", stringify!($obj));

                    let res_del = diesel::sql_query(format!(
                            "SELECT COUNT (*) AS nb FROM infra_object_{} WHERE obj_id = '{}' AND infra_id = {}",
                            stringify!([<$obj:snake>]),
                            railjson_object.get_id(),
                            infra.id
                        ))
                        .get_result::<Count>(db_pool.get_ok().deref_mut()).await.unwrap();

                    pretty_assertions::assert_eq!(res_del.nb, 0);
                }
            }
        };
    }

    test_delete_object!(TrackSection);
    test_delete_object!(Signal);
    test_delete_object!(SpeedSection);
    test_delete_object!(TrackNode);
    test_delete_object!(Detector);
    test_delete_object!(BufferStop);
    test_delete_object!(Route);
    test_delete_object!(OperationalPoint);
    test_delete_object!(Electrification);
    test_delete_object!(NeutralSection);
}
