use derivative::Derivative;
use diesel::sql_types::Double;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel_json::Json as DieselJson;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::schema::LogicalSignal;
use crate::schema::Signal;

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
