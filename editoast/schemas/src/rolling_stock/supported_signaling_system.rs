use std::collections::HashSet;
use std::hash::Hash;
use std::hash::Hasher;

use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use utoipa::ToSchema;

use crate::rolling_stock::EtcsBrakeParams;

#[derive(
    Clone,
    Debug,
    Deserialize,
    Serialize,
    Display,
    Educe,
    ToSchema,
    strum::IntoStaticStr,
    strum::EnumDiscriminants,
)]
#[educe(Hash, Eq, PartialEq)]
#[serde(tag = "type")]
#[schema(title_variants)]
#[allow(clippy::large_enum_variant)]
#[strum_discriminants(
    name(SupportedSignalingSystemVariant),
    derive(Deserialize, Serialize, Display, Hash, ToSchema, strum::IntoStaticStr)
)]
pub enum SupportedSignalingSystem {
    BAL,
    BAPR,
    TVM300,
    TVM430,
    #[strum(to_string = "ETCS_LEVEL2")]
    #[serde(rename = "ETCS_LEVEL2")]
    #[strum_discriminants(strum(to_string = "ETCS_LEVEL2"))]
    #[strum_discriminants(serde(rename = "ETCS_LEVEL2"))]
    EtcsLevel2 {
        #[educe(Hash(ignore), PartialEq(ignore))]
        brake_params: EtcsBrakeParams,
    },
}

impl SupportedSignalingSystem {
    const fn discriminant(&self) -> u32 {
        match self {
            SupportedSignalingSystem::BAL => 0,
            SupportedSignalingSystem::BAPR => 1,
            SupportedSignalingSystem::TVM300 => 2,
            SupportedSignalingSystem::TVM430 => 3,
            SupportedSignalingSystem::EtcsLevel2 { .. } => 4,
        }
    }
}

impl SupportedSignalingSystemVariant {
    const fn discriminant(&self) -> u32 {
        match self {
            SupportedSignalingSystemVariant::BAL => 0,
            SupportedSignalingSystemVariant::BAPR => 1,
            SupportedSignalingSystemVariant::TVM300 => 2,
            SupportedSignalingSystemVariant::TVM430 => 3,
            SupportedSignalingSystemVariant::EtcsLevel2 => 4,
        }
    }
}

pub fn hashing_supported_signaling_systems<H>(
    iter: &HashSet<SupportedSignalingSystem>,
    state: &mut H,
) where
    H: Hasher,
{
    let hash: u64 = iter
        .iter()
        .map(SupportedSignalingSystem::discriminant)
        // Each discriminant correspond to one specific bit of a `u64`
        .map(|discriminant| 1u64.wrapping_shl(discriminant))
        // Create a unique bitmask
        .reduce(std::ops::BitOr::bitor)
        .unwrap_or(0);
    Hash::hash(&hash, state)
}

pub fn hashing_supported_signaling_systems_variant<H>(
    iter: &HashSet<SupportedSignalingSystemVariant>,
    state: &mut H,
) where
    H: Hasher,
{
    let hash: u64 = iter
        .iter()
        .map(SupportedSignalingSystemVariant::discriminant)
        // Each discriminant correspond to one specific bit of a `u64`
        .map(|discriminant| 1u64.wrapping_shl(discriminant))
        // Create a unique bitmask
        .reduce(std::ops::BitOr::bitor)
        .unwrap_or(0);
    Hash::hash(&hash, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    mod hash {
        use super::*;
        use SupportedSignalingSystemVariant::*;

        use proptest::prelude::*;

        fn supported_signaling_system_strategy_variant()
        -> impl Strategy<Value = SupportedSignalingSystemVariant> {
            prop_oneof![
                Just(BAL),
                Just(BAPR),
                Just(TVM300),
                Just(TVM430),
                Just(EtcsLevel2)
            ]
            .boxed()
        }

        fn hash(iter: &HashSet<SupportedSignalingSystemVariant>) -> u64 {
            let mut state = std::hash::DefaultHasher::new();
            hashing_supported_signaling_systems_variant(iter, &mut state);
            state.finish()
        }

        proptest! {
            #[test]
            fn remove_element_has_different_hash(
                mut a in proptest::collection::hash_set(supported_signaling_system_strategy_variant(), 0..10),
                s in supported_signaling_system_strategy_variant(),
            ) {
                let hash_before = hash(&a);
                let is_removed = a.remove(&s);
                let hash_after = hash(&a);
                if is_removed {
                    assert_ne!(hash_before, hash_after);
                } else {
                    assert_eq!(hash_before, hash_after);
                }
            }

            #[test]
            fn same_hashset_has_same_hash(
                a in proptest::collection::hash_set(supported_signaling_system_strategy_variant(), 0..10),
                b in proptest::collection::hash_set(supported_signaling_system_strategy_variant(), 0..10)
            ) {
                if a == b {
                    assert_eq!(hash(&a), hash(&b));
                } else {
                    assert_ne!(hash(&a), hash(&b));
                }
            }

            #[test]
            fn same_hash_has_an_empty_difference(
                a in proptest::collection::hash_set(supported_signaling_system_strategy_variant(), 0..10),
                b in proptest::collection::hash_set(supported_signaling_system_strategy_variant(), 0..10)
            ) {
                if hash(&a) == hash(&b) {
                    assert!(a.symmetric_difference(&b).count() == 0);
                } else {
                    assert!(a.symmetric_difference(&b).count() > 0);
                }
            }

            #[test]
            fn different_signaling_system_has_different_hash(
                a in supported_signaling_system_strategy_variant(),
                b in supported_signaling_system_strategy_variant(),
            ) {
                let same_signaling_system= a == b;
                let hash_a = hash(&HashSet::from([a]));
                let hash_b = hash(&HashSet::from([b]));
                if same_signaling_system {
                    assert_eq!(hash_a, hash_b);
                } else {
                    assert_ne!(hash_a , hash_b);
                }
            }
        }
    }
}
