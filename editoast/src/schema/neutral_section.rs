use super::{OSRDIdentified, OSRDTyped, ObjectType, Sign};

use super::utils::Identifier;
use super::DirectionalTrackRange;

use derivative::Derivative;
use serde::{Deserialize, Serialize};

/// Neutral sections are portions of track where trains aren't allowed to pull power from electrifications. They have to rely on inertia to cross such sections.
///
/// In practice, neutral sections are delimited by signs. In OSRD, neutral sections are directional to allow accounting for different sign placement depending on the direction.
///
/// For more details see [the documentation](https://osrd.fr/en/docs/explanation/neutral_sections/).
#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct NeutralSection {
    pub id: Identifier,
    pub announcement_track_ranges: Vec<DirectionalTrackRange>,
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub lower_pantograph: bool, // Whether the trains need to lower their pantograph to cross this section
    #[serde(default)]
    pub extensions: NeutralSectionExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NeutralSectionExtensions {
    pub neutral_sncf: Option<NeutralSectionNeutralSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NeutralSectionNeutralSncfExtension {
    announcement: Vec<Sign>,
    exe: Sign,
    end: Vec<Sign>,
    rev: Vec<Sign>,
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
