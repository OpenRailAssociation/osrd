use super::generate_id;
use super::OSRDIdentified;

use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;
use crate::api_error::ApiError;
use crate::diesel::ExpressionMethods;
use crate::diesel::RunQueryDsl;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::tables::osrd_infra_tracksectionlinkmodel::dsl::*;
use derivative::Derivative;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionLink {
    #[derivative(Default(value = r#"generate_id("track_section_link")"#))]
    pub id: String,
    pub src: TrackEndpoint,
    pub dst: TrackEndpoint,
}

impl TrackSectionLink {
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

        diesel::insert_into(osrd_infra_tracksectionlinkmodel)
            .values(datas)
            .execute(conn)?;

        Ok(())
    }
}

impl OSRDTyped for TrackSectionLink {
    fn get_type() -> ObjectType {
        ObjectType::TrackSectionLink
    }
}

impl OSRDIdentified for TrackSectionLink {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Cache for TrackSectionLink {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.src.track, &self.dst.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackSectionLink(self.clone())
    }
}

#[cfg(test)]
mod test {

    use super::TrackSectionLink;
    use crate::infra::tests::test_infra_transaction;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| TrackSectionLink::default())
                .collect::<Vec<TrackSectionLink>>();

            assert!(TrackSectionLink::persist_batch(&data, infra.id, conn).is_ok());
        });
    }
}
