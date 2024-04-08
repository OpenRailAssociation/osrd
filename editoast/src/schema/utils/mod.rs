mod non_blank_string;

use editoast_common::geometry;
pub use non_blank_string::NonBlankString;

editoast_common::schemas! {
    geometry::schemas(),
}
