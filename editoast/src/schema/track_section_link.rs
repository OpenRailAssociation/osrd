use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_tracksectionlinkmodel")]
#[derivative(Default)]
pub struct TrackSectionLink {
    pub id: Identifier,
    pub src: TrackEndpoint,
    pub dst: TrackEndpoint,
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
    use crate::models::infra::tests::test_infra_transaction;

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
