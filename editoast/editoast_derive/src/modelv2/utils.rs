/// Nested pair macro
///
/// Helps when using `unzip()` on lot of values.
macro_rules! np {
    (vec2) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>) };
    (vec3) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>, Vec<_>) };
    (vec4) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec5) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec6) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec7) => { $crate::modelv2::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    ($id:ident, $($rest:ident),+) => { ($id, $crate::modelv2::utils::np!($($rest),+)) };
    ($id:ident) => { $id };
    ($t:ty, $($rest:ty),+) => { ($t, $crate::modelv2::utils::np!($($rest),+)) };
    ($t:ty) => { $t };
    ($e:expr, $($rest:expr),+) => { ($e, $crate::modelv2::utils::np!($($rest),+)) };
    ($e:expr) => { $e };
}

pub(crate) use np;
