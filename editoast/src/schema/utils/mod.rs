pub mod geometry;
mod identifier;
mod non_blank_string;

pub use identifier::Identifier;
pub use non_blank_string::NonBlankString;

use crate::schemas;

schemas! {
    &non_blank_string::NonBlankString,
    identifier::schemas(),
    geometry::schemas(),
}
