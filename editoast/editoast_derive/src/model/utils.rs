/// Nested pair macro
///
/// Helps when using `unzip()` on lot of values.
macro_rules! np {
    (vec2) => { $crate::model::utils::np!(Vec<_>, Vec<_>) };
    (vec3) => { $crate::model::utils::np!(Vec<_>, Vec<_>, Vec<_>) };
    (vec4) => { $crate::model::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec5) => { $crate::model::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec6) => { $crate::model::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    (vec7) => { $crate::model::utils::np!(Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>, Vec<_>) };
    ($id:ident, $($rest:ident),+) => { ($id, $crate::model::utils::np!($($rest),+)) };
    ($id:ident) => { $id };
    ($t:ty, $($rest:ty),+) => { ($t, $crate::model::utils::np!($($rest),+)) };
    ($t:ty) => { $t };
    ($e:expr, $($rest:expr),+) => { ($e, $crate::model::utils::np!($($rest),+)) };
    ($e:expr) => { $e };
}

pub(crate) use np;
