use super::{OSRDIdentified, OSRDTyped, ObjectType};

use super::utils::Identifier;
use super::DirectionalTrackRange;

use derivative::Derivative;
use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::osrd_infra_neutralsectionmodel")]
#[derivative(Default)]
pub struct NeutralSection {
    pub id: Identifier,
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub is_pantograph_drop_zone: bool,
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

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| NeutralSection::default())
                .collect::<Vec<NeutralSection>>();

            assert!(NeutralSection::persist_batch(&data, infra.id.unwrap(), conn).is_ok());
        })
        .await;
    }
}
