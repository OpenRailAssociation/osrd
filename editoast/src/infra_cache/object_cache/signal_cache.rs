use diesel::sql_types::Double;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel_json::Json as DieselJson;
use educe::Educe;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::OSRDTyped;
use schemas::primitives::ObjectType;
use serde::Deserialize;
use serde::Serialize;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use schemas::infra::LogicalSignal;
use schemas::infra::Signal;

#[derive(QueryableByName, Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq)]
pub struct SignalCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    #[diesel(sql_type = Double)]
    pub position: f64,
    #[educe(Hash(ignore), PartialEq(ignore))]
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
