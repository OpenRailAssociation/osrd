use std::hash::Hash;
use std::hash::Hasher;

use crate::units;
use crate::units::quantities::Length;

pub fn hash_length_slice<H: Hasher>(value: &[Length], state: &mut H) {
    value
        .iter()
        .for_each(|length| units::millimeter::hash(length, state))
}
