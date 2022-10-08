use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDObject;
use super::ObjectType;
use super::Waypoint;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::tables::osrd_infra_routemodel::dsl::*;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: Waypoint,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<String>,
    pub path: Vec<DirectionalTrackRange>,
}

impl Route {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        let datas = values
            .iter()
            .map(|value| {
                (
                    obj_id.eq(value.get_id().clone()),
                    data.eq(serde_json::to_value(value).unwrap()),
                    infra_id.eq(infrastructure_id),
                )
            })
            .collect::<Vec<_>>();

        diesel::insert_into(osrd_infra_routemodel)
            .values(datas)
            .execute(conn)?;

        Ok(())
    }
}

impl OSRDObject for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Route
    }
}

impl Cache for Route {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.path.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Route(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::Route;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10).map(|_| Route::default()).collect::<Vec<Route>>();

            assert!(Route::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
