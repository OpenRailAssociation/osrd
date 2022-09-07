use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectType;
use super::TrackEndpoint;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionLink {
    #[derivative(Default(value = r#"generate_id("track_section_link")"#))]
    pub id: String,
    pub src: TrackEndpoint,
    pub dst: TrackEndpoint,
    pub navigability: ApplicableDirections,
}

impl OSRDObject for TrackSectionLink {
    fn get_id(&self) -> String {
        self.id.clone()
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::TrackSectionLink
    }
}
