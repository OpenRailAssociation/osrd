use super::generate_id;
use super::ApplicableDirectionsTrackRange;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};
#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Catenary {
    #[derivative(Default(value = r#"generate_id("catenary")"#))]
    pub id: String,
    pub voltage: f64,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl Catenary {
    pub fn persist_batch(
        values: &[Self],
        infrastructure_id: i32,
        conn: &PgConnection,
    ) -> Result<(), Box<dyn ApiError>> {
        use crate::tables::osrd_infra_catenarymodel::dsl::*;

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

        diesel::insert_into(osrd_infra_catenarymodel)
            .values(datas)
            .execute(conn)?;

        Ok(())
    }
}

impl OSRDTyped for Catenary {
    fn get_type() -> ObjectType {
        ObjectType::Catenary
    }
}

impl OSRDIdentified for Catenary {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Cache for Catenary {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.track_ranges.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Catenary(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::Catenary;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| Catenary::default())
                .collect::<Vec<Catenary>>();

            assert!(Catenary::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
