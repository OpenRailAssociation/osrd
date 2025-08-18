use std::hash::Hash;
use std::hash::Hasher;

/// Hash a float through a rounded integer value
/// `hash_float<3,_>` means that the value is rounded to the nearest thousandth
pub fn hash_float<const T: u8, H: Hasher>(value: &f64, state: &mut H) {
    ((value * 10i64.pow(T as u32) as f64).round() as i64).hash(state);
}

/// Hash a list of floats through a list of rounded integer value
/// `hash_float_slice<3,_>` means that the values are rounded to the nearest thousandth
pub fn hash_float_slice<const T: u8, H: Hasher>(value: &[f64], state: &mut H) {
    let slice: Vec<_> = value
        .iter()
        .map(|v| (v * 10i64.pow(T as u32) as f64).round() as i64)
        .collect();
    slice.hash(state);
}
