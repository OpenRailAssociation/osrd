mod identifier;
mod non_blank_string;

use editoast_common::geometry;
pub use identifier::Identifier;
pub use non_blank_string::NonBlankString;

editoast_common::schemas! {
    geometry::schemas(),
}
