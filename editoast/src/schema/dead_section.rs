use super::{OSRDIdentified, OSRDTyped, ObjectType};

use super::utils::Identifier;
use super::DirectionalTrackRange;

use derivative::Derivative;
use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_deadsectionmodel")]
#[derivative(Default)]
pub struct DeadSection {
    pub id: Identifier,
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub backside_pantograph_track_ranges: Vec<DirectionalTrackRange>,
    pub is_pantograph_drop_zone: bool,
}

impl OSRDTyped for DeadSection {
    fn get_type() -> ObjectType {
        ObjectType::DeadSection
    }
}

impl OSRDIdentified for DeadSection {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[cfg(test)]
mod test {
    use super::DeadSection;
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| DeadSection::default())
                .collect::<Vec<DeadSection>>();

            assert!(DeadSection::persist_batch(&data, infra.id.unwrap(), conn).is_ok());
        })
        .await;
    }
}
