use std::collections::HashMap;

use super::Direction;
use super::OSRDIdentified;

use super::utils::Identifier;
use super::utils::NonBlankString;
use super::OSRDTyped;
use super::ObjectType;
use super::Side;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::sql_types::{Double, Jsonb, Text};
use diesel_json::Json as DieselJson;

use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, InfraModel)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_signal")]
#[derivative(Default)]
pub struct Signal {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    #[derivative(Default(value = "400."))]
    pub sight_distance: f64,
    #[serde(default)]
    pub logical_signals: Vec<LogicalSignal>,
    #[serde(default)]
    pub extensions: SignalExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct LogicalSignal {
    pub signaling_system: String,
    pub next_signaling_systems: Vec<String>,
    pub settings: HashMap<NonBlankString, NonBlankString>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalExtensions {
    pub sncf: Option<SignalSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalSncfExtension {
    pub label: String,
    pub side: Side,
    pub kp: String,
}

impl OSRDTyped for Signal {
    fn get_type() -> ObjectType {
        ObjectType::Signal
    }
}

impl OSRDIdentified for Signal {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SignalCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Double)]
    pub position: f64,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Jsonb)]
    pub logical_signals: DieselJson<Vec<LogicalSignal>>,
}

impl OSRDTyped for SignalCache {
    fn get_type() -> ObjectType {
        ObjectType::Signal
    }
}

impl OSRDIdentified for SignalCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for SignalCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Signal(self.clone())
    }
}

impl SignalCache {
    pub fn new(
        obj_id: String,
        track: String,
        position: f64,
        logical_signals: Vec<LogicalSignal>,
    ) -> Self {
        Self {
            obj_id,
            track,
            position,
            logical_signals: DieselJson(logical_signals),
        }
    }
}

impl From<Signal> for SignalCache {
    fn from(sig: Signal) -> Self {
        Self::new(sig.id.0, sig.track.0, sig.position, sig.logical_signals)
    }
}

#[cfg(test)]
mod test {
    use super::Signal;
    use super::SignalExtensions;
    use crate::models::infra::tests::test_infra_transaction;
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;
    use serde_json::from_str;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10).map(|_| Signal::default()).collect::<Vec<Signal>>();

                assert!(Signal::persist_batch(&data, infra.id.unwrap(), conn)
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await;
    }

    #[test]
    fn test_signal_extensions_deserialization() {
        from_str::<SignalExtensions>(r#"{}"#).unwrap();
    }
}
