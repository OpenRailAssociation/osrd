use crate::schemas;

use super::{OSRDIdentified, OSRDTyped, ObjectType};

use super::utils::Identifier;
use super::DirectionalTrackRange;

use derivative::Derivative;
use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

schemas! {
    NeutralSection,
}

/// Neutral sections are portions of track where trains aren't allowed to pull power from catenaries. They have to rely on inertia to cross such sections.
///
/// In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional to allow accounting for different sign placement depending on the direction.
///
/// For more details see [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel, ToSchema)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_neutral_section")]
#[derivative(Default)]
pub struct NeutralSection {
    pub id: Identifier,
    pub announcement_track_ranges: Vec<DirectionalTrackRange>,
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub lower_pantograph: bool, // Whether the trains need to lower their pantograph to cross this section
}

impl OSRDTyped for NeutralSection {
    fn get_type() -> ObjectType {
        ObjectType::NeutralSection
    }
}

impl OSRDIdentified for NeutralSection {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[cfg(test)]
mod test {
    use super::NeutralSection;
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10)
                    .map(|_| NeutralSection::default())
                    .collect::<Vec<NeutralSection>>();

                assert!(
                    NeutralSection::persist_batch(&data, infra.id.unwrap(), conn)
                        .await
                        .is_ok()
                );
            }
            .scope_boxed()
        })
        .await;
    }
}
