use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionSncfExtension {
    pub line_code: i32,
    #[derivative(Default(value = r#""line_test".into()"#))]
    #[schema(inline)]
    pub line_name: NonBlankString,
    pub track_number: i32,
    #[derivative(Default(value = r#""track_test".into()"#))]
    #[schema(inline)]
    pub track_name: NonBlankString,
}
