use super::OSRDIdentified;

use super::utils::Identifier;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use derivative::Derivative;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_extend_switch_type")]
#[derivative(Default)]
pub struct SwitchType {
    pub id: Identifier,
    pub ports: Vec<Identifier>,
    pub groups: HashMap<Identifier, Vec<SwitchPortConnection>>,
}

impl OSRDTyped for SwitchType {
    fn get_type() -> ObjectType {
        ObjectType::SwitchType
    }
}

impl OSRDIdentified for SwitchType {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchPortConnection {
    pub src: Identifier,
    pub dst: Identifier,
}

impl Cache for SwitchType {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SwitchType(self.clone())
    }
}

pub fn default_node_types() -> Vec<SwitchType> {
    let mut link_group = std::collections::HashMap::new();
    link_group.insert(
        "LINK".into(),
        vec![SwitchPortConnection {
            src: "A".into(),
            dst: "B".into(),
        }],
    );

    let mut point_groups = std::collections::HashMap::new();
    point_groups.insert(
        "B1".into(),
        vec![SwitchPortConnection {
            src: "A".into(),
            dst: "B2".into(),
        }],
    );
    point_groups.insert(
        "B1".into(),
        vec![SwitchPortConnection {
            src: "A".into(),
            dst: "B1".into(),
        }],
    );

    let mut cross_groups = std::collections::HashMap::new();
    cross_groups.insert(
        "DEFAULT".into(),
        vec![
            SwitchPortConnection {
                src: "A1".into(),
                dst: "B1".into(),
            },
            SwitchPortConnection {
                src: "A2".into(),
                dst: "B2".into(),
            },
        ],
    );

    let mut simple_cross_groups = std::collections::HashMap::new();
    simple_cross_groups.insert(
        "DEFAULT_2".into(),
        vec![
            SwitchPortConnection {
                src: "A1".into(),
                dst: "B1".into(),
            },
            SwitchPortConnection {
                src: "A2".into(),
                dst: "B2".into(),
            },
        ],
    );
    simple_cross_groups.insert(
        "A1-B2".into(),
        vec![SwitchPortConnection {
            src: "A1".into(),
            dst: "B2".into(),
        }],
    );

    let mut double_cross_groups = std::collections::HashMap::new();
    double_cross_groups.insert(
        "A1-B1".into(),
        vec![SwitchPortConnection {
            src: "A1".into(),
            dst: "B1".into(),
        }],
    );
    double_cross_groups.insert(
        "A1-B2".into(),
        vec![SwitchPortConnection {
            src: "A1".into(),
            dst: "B2".into(),
        }],
    );
    double_cross_groups.insert(
        "A2-B1".into(),
        vec![SwitchPortConnection {
            src: "A2".into(),
            dst: "B1".into(),
        }],
    );
    double_cross_groups.insert(
        "A2-B2".into(),
        vec![SwitchPortConnection {
            src: "A2".into(),
            dst: "B2".into(),
        }],
    );

    vec![
        SwitchType {
            id: "link".into(),
            ports: vec!["A".into(), "B".into()],
            groups: link_group,
        },
        SwitchType {
            id: "point_switch".into(),
            ports: vec!["A".into(), "A1".into(), "A2".into()],
            groups: point_groups,
        },
        SwitchType {
            id: "crossing".into(),
            ports: vec!["A1".into(), "B1".into(), "A2".into(), "B2".into()],
            groups: cross_groups,
        },
        SwitchType {
            id: "single_slip_switch".into(),
            ports: vec!["B1".into(), "B2".into(), "A1".into(), "A2".into()],
            groups: simple_cross_groups,
        },
        SwitchType {
            id: "double_slip_switch".into(),
            ports: vec!["A1".into(), "A2".into(), "B1".into(), "B2".into()],
            groups: double_cross_groups,
        },
    ]
}

#[cfg(test)]
mod test {

    use super::SwitchType;
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10)
                    .map(|_| SwitchType::default())
                    .collect::<Vec<SwitchType>>();

                assert!(SwitchType::persist_batch(&data, infra.id.unwrap(), conn)
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await;
    }
}
