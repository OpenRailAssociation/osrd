use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::schemas;

use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

schemas! {
    TrackSectionLink,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel, ToSchema)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_track_section_link")]
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
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10)
                    .map(|_| TrackSectionLink::default())
                    .collect::<Vec<TrackSectionLink>>();

                assert!(
                    TrackSectionLink::persist_batch(&data, infra.id.unwrap(), conn)
                        .await
                        .is_ok()
                );
            }
            .scope_boxed()
        })
        .await;
    }
}
