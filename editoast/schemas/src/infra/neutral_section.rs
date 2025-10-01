use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::DirectionalTrackRange;
use super::Sign;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

/// Neutral sections are portions of track where trains aren't allowed to pull power from electrifications. They have to rely on inertia to cross such sections.
///
/// In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional to allow accounting for different sign placement depending on the direction.
///
/// For more details see [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct NeutralSection {
    #[schema(inline)]
    pub id: Identifier,
    pub announcement_track_ranges: Vec<DirectionalTrackRange>,
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub lower_pantograph: bool, // Whether the trains need to lower their pantograph to cross this section
    #[serde(default)]
    #[schema(inline)]
    pub extensions: NeutralSectionExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct NeutralSectionExtensions {
    #[schema(inline)]
    pub neutral_sncf: Option<NeutralSectionNeutralSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct NeutralSectionNeutralSncfExtension {
    pub announcement: Vec<Sign>,
    pub exe: Sign,
    pub end: Vec<Sign>,
    pub rev: Vec<Sign>,
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
