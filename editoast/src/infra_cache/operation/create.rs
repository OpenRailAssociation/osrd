use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use json_patch::Patch;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;

use super::OperationError;
use crate::error::Result;
use crate::modelsv2::get_table;
use crate::modelsv2::DbConnection;
use editoast_schemas::infra::BufferStop;
use editoast_schemas::infra::Detector;
use editoast_schemas::infra::Electrification;
use editoast_schemas::infra::NeutralSection;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::infra::Route;
use editoast_schemas::infra::Signal;
use editoast_schemas::infra::SpeedSection;
use editoast_schemas::infra::Switch;
use editoast_schemas::infra::SwitchType;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::primitives::ObjectType;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, utoipa::ToSchema)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum InfraObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    NeutralSection { railjson: NeutralSection },
    SpeedSection { railjson: SpeedSection },
    Switch { railjson: Switch },
    SwitchType { railjson: SwitchType },
    Detector { railjson: Detector },
    BufferStop { railjson: BufferStop },
    Route { railjson: Route },
    OperationalPoint { railjson: OperationalPoint },
    Electrification { railjson: Electrification },
}

pub async fn apply_create_operation<'r>(
    railjson_object: &'r InfraObject,
    infra_id: i64,
    conn: &mut DbConnection,
) -> Result<(usize, &'r InfraObject)> {
    if railjson_object.get_id().is_empty() {
        return Err(OperationError::EmptyId.into());
    }
    sql_query(format!(
        "INSERT INTO {} (infra_id, obj_id, data) VALUES ($1, $2, $3)",
        get_table(&railjson_object.get_type())
    ))
    .bind::<BigInt, _>(infra_id)
    .bind::<Text, _>(railjson_object.get_id())
    .bind::<Json, _>(railjson_object.get_data())
    .execute(conn)
    .await
    .map(|idx| (idx, railjson_object))
    .map_err(|err| err.into())
}

impl OSRDIdentified for InfraObject {
    fn get_id(&self) -> &String {
        self.get_obj().get_id()
    }
}

impl OSRDObject for InfraObject {
    fn get_type(&self) -> ObjectType {
        self.get_obj().get_type()
    }
}

impl InfraObject {
    pub fn get_obj(&self) -> &dyn OSRDObject {
        match self {
            InfraObject::TrackSection { railjson: obj } => obj,
            InfraObject::Signal { railjson: obj } => obj,
            InfraObject::NeutralSection { railjson: obj } => obj,
            InfraObject::SpeedSection { railjson: obj } => obj,
            InfraObject::Switch { railjson: obj } => obj,
            InfraObject::SwitchType { railjson: obj } => obj,
            InfraObject::Detector { railjson: obj } => obj,
            InfraObject::BufferStop { railjson: obj } => obj,
            InfraObject::Route { railjson: obj } => obj,
            InfraObject::OperationalPoint { railjson: obj } => obj,
            InfraObject::Electrification { railjson: obj } => obj,
        }
    }

    pub fn get_data(&self) -> Value {
        match self {
            InfraObject::TrackSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Signal { railjson: obj } => serde_json::to_value(obj),
            InfraObject::SpeedSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::NeutralSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Switch { railjson: obj } => serde_json::to_value(obj),
            InfraObject::SwitchType { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Detector { railjson: obj } => serde_json::to_value(obj),
            InfraObject::BufferStop { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Route { railjson: obj } => serde_json::to_value(obj),
            InfraObject::OperationalPoint { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Electrification { railjson: obj } => serde_json::to_value(obj),
        }
        .unwrap()
    }

    pub fn patch(self, json_patch: &Patch) -> Result<Self> {
        // `json_patch::patch()` operates on `serde_json::Value`.
        // Therefore, we have to:
        // (1) transform `InfraObject` into `serde_json::Value`,
        // (2) patch the object,
        // (3) transform `serde_json::Value` back into a `InfraObject`.
        // The code below is explicitely typed (even if not needed) to help understand this dance.
        let object_type = self.get_type();
        let mut value: serde_json::Value = match &self {
            InfraObject::TrackSection { railjson } => serde_json::to_value(railjson)?,
            InfraObject::Signal { railjson } => serde_json::to_value(railjson)?,
            InfraObject::NeutralSection { railjson } => serde_json::to_value(railjson)?,
            InfraObject::SpeedSection { railjson } => serde_json::to_value(railjson)?,
            InfraObject::Switch { railjson } => serde_json::to_value(railjson)?,
            InfraObject::SwitchType { railjson } => serde_json::to_value(railjson)?,
            InfraObject::Detector { railjson } => serde_json::to_value(railjson)?,
            InfraObject::BufferStop { railjson } => serde_json::to_value(railjson)?,
            InfraObject::Route { railjson } => serde_json::to_value(railjson)?,
            InfraObject::OperationalPoint { railjson } => serde_json::to_value(railjson)?,
            InfraObject::Electrification { railjson } => serde_json::to_value(railjson)?,
        };
        json_patch::patch(&mut value, json_patch)?;
        let railjson_object = match object_type {
            ObjectType::TrackSection => InfraObject::TrackSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Signal => InfraObject::Signal {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::SpeedSection => InfraObject::SpeedSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Detector => InfraObject::Detector {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::NeutralSection => InfraObject::NeutralSection {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Switch => InfraObject::Switch {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::SwitchType => InfraObject::SwitchType {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::BufferStop => InfraObject::BufferStop {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Route => InfraObject::Route {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::OperationalPoint => InfraObject::OperationalPoint {
                railjson: serde_json::from_value(value)?,
            },
            ObjectType::Electrification => InfraObject::Electrification {
                railjson: serde_json::from_value(value)?,
            },
        };
        Ok(railjson_object)
    }
}

impl From<TrackSection> for InfraObject {
    fn from(track: TrackSection) -> Self {
        InfraObject::TrackSection { railjson: track }
    }
}

impl From<Electrification> for InfraObject {
    fn from(electrification: Electrification) -> Self {
        InfraObject::Electrification {
            railjson: electrification,
        }
    }
}

impl From<Signal> for InfraObject {
    fn from(signal: Signal) -> Self {
        InfraObject::Signal { railjson: signal }
    }
}

impl From<SpeedSection> for InfraObject {
    fn from(speedsection: SpeedSection) -> Self {
        InfraObject::SpeedSection {
            railjson: speedsection,
        }
    }
}

impl From<NeutralSection> for InfraObject {
    fn from(neutralsection: NeutralSection) -> Self {
        InfraObject::NeutralSection {
            railjson: neutralsection,
        }
    }
}

impl From<Switch> for InfraObject {
    fn from(switch: Switch) -> Self {
        InfraObject::Switch { railjson: switch }
    }
}

impl From<SwitchType> for InfraObject {
    fn from(switchtype: SwitchType) -> Self {
        InfraObject::SwitchType {
            railjson: switchtype,
        }
    }
}

impl From<Detector> for InfraObject {
    fn from(detector: Detector) -> Self {
        InfraObject::Detector { railjson: detector }
    }
}

impl From<BufferStop> for InfraObject {
    fn from(bufferstop: BufferStop) -> Self {
        InfraObject::BufferStop {
            railjson: bufferstop,
        }
    }
}

impl From<Route> for InfraObject {
    fn from(route: Route) -> Self {
        InfraObject::Route { railjson: route }
    }
}

impl From<OperationalPoint> for InfraObject {
    fn from(operationalpoint: OperationalPoint) -> Self {
        InfraObject::OperationalPoint {
            railjson: operationalpoint,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::NeutralSection;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::Switch;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::TrackSection;
    use std::ops::DerefMut;

    macro_rules! test_create_object {
        ($obj:ident) => {
            paste::paste! {
                #[rstest::rstest]
                async fn [<test_create_ $obj:snake>]() {
                    let db_pool = crate::modelsv2::DbConnectionPoolV2::for_tests();
                    let infra = crate::modelsv2::fixtures::create_empty_infra(db_pool.get_ok().deref_mut()).await;
                    let infra_object = crate::infra_cache::operation::InfraObject::$obj {
                        railjson: $obj::default(),
                    };
                    let result = crate::infra_cache::operation::create::apply_create_operation(&infra_object, infra.id, db_pool.get_ok().deref_mut()).await;
                    assert!(result.is_ok(), "Failed to create a {}", stringify!($obj));
                }
            }
        };
    }

    test_create_object!(TrackSection);
    test_create_object!(Signal);
    test_create_object!(SpeedSection);
    test_create_object!(Switch);
    test_create_object!(Detector);
    test_create_object!(BufferStop);
    test_create_object!(Route);
    test_create_object!(OperationalPoint);
    test_create_object!(SwitchType);
    test_create_object!(Electrification);
    test_create_object!(NeutralSection);
}
