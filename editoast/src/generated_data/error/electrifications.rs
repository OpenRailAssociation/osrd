use std::collections::HashMap;
use std::collections::HashSet;

use rangemap::RangeMap;

use super::GlobalErrorGenerator;
use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::ObjectRef;
use schemas::primitives::ObjectType;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_empty),
    ObjectErrorGenerator::new(2, check_electrification_track_ranges),
];

pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<NoContext>; 1] =
    [GlobalErrorGenerator::new(check_overlapping)];

/// Check if a track section has empty electrification
pub fn check_empty(electrification: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let electrification = electrification.unwrap_electrification();
    if electrification.track_ranges.is_empty() {
        vec![InfraError::new_empty_object(
            electrification,
            "track_ranges",
        )]
    } else {
        vec![]
    }
}
/// Retrieve invalid refs and out of range errors for speed sections
pub fn check_electrification_track_ranges(
    electrification: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let electrification = electrification.unwrap_electrification();
    for (index, track_range) in electrification.track_ranges.iter().enumerate() {
        let track_id = &track_range.track;
        if !infra_cache
            .track_sections()
            .contains_key::<String>(track_id)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, track_id);
            infra_errors.push(InfraError::new_invalid_reference(
                electrification,
                format!("track_ranges.{index}"),
                obj_ref,
            ));
            continue;
        }
        let track_cache = infra_cache
            .track_sections()
            .get::<String>(track_id)
            .unwrap()
            .unwrap_track_section();
        for (pos, field) in [(track_range.begin, "begin"), (track_range.end, "end")] {
            if !(0.0..=track_cache.length).contains(&pos) {
                infra_errors.push(InfraError::new_out_of_range(
                    electrification,
                    format!("track_ranges.{index}.{field}"),
                    pos,
                    [0.0, track_cache.length],
                ));
            }
        }
    }
    infra_errors
}

/// Checks that electrifications don't overlap
pub fn check_overlapping(infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let mut overlapping_cat = HashSet::new();
    // Key: (Track, Voltage)
    // Value: RangeMap<Range, ElectrificationId>

    let mut range_maps: HashMap<(String, String), RangeMap<u64, String>> = Default::default();

    // Iterate over all the electrifications ensure we don't report duplicated errors
    for electrification in infra_cache.electrifications().values() {
        let electrification = electrification.unwrap_electrification();

        let voltage = electrification.voltage.0.clone();

        for track_range in electrification.track_ranges.iter() {
            let range = (track_range.begin * 100.) as u64..(track_range.end * 100.) as u64;
            let track_id = &track_range.track.0;

            let key = (track_id.clone(), voltage.clone());
            let range_map = range_maps.entry(key).or_default();

            for (_, overlap) in range_map.overlapping(&range) {
                if electrification.get_id() == overlap {
                    // Avoid reporting overlap with itself
                    continue;
                }
                overlapping_cat.insert((electrification.get_id().clone(), overlap.clone()));
            }

            range_map.insert(range.clone(), electrification.get_id().to_string());
        }
    }

    // Map the overlapping electrifications to infra errors
    overlapping_cat
        .into_iter()
        .map(|(sc1, sc2)| InfraError::new_overlapping_electrifications(sc1, sc2))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::InfraError;
    use super::check_electrification_track_ranges;
    use crate::generated_data::error::electrifications::check_overlapping;
    use crate::infra_cache::Graph;
    use crate::infra_cache::tests::create_electrification_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use rstest::rstest;
    use schemas::primitives::ObjectRef;
    use schemas::primitives::ObjectType;

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        let electrification = create_electrification_cache("Cat_error", track_ranges_error);
        infra_cache.add(&electrification).unwrap();
        let errors = check_electrification_track_ranges(
            &electrification.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error =
            InfraError::new_invalid_reference(&electrification, "track_ranges.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        let electrification = create_electrification_cache("Cat_error", track_ranges_error);
        infra_cache.add(&electrification).unwrap();
        let errors = check_electrification_track_ranges(
            &electrification.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_out_of_range(&electrification, "track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }

    /// Test overlapping electrifications with different voltages should not raise warnings.
    #[rstest]
    #[case::subset(100., 150.)]
    #[case::overlap_at_boundary(200., 480.)]
    fn overlapping_different_voltage(#[case] start: f64, #[case] end: f64) {
        let mut infra_cache = create_small_infra_cache();

        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut electrification_1 = create_electrification_cache("Cat_error_1", track_ranges_1);
        electrification_1.voltage = "1500V".into();
        infra_cache.add(&electrification_1).unwrap();

        let track_ranges_2 = vec![("A", start, end)];
        let mut electrification_2 = create_electrification_cache("Cat_error_2", track_ranges_2);
        electrification_2.voltage = "25000V".into();
        infra_cache.add(&electrification_2).unwrap();

        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        assert_eq!(0, errors.len());
    }

    /// Test overlapping electrifications with same voltage should raise a warning.
    #[rstest]
    #[case::subset(100., 150.)]
    #[case::overlap_at_boundary(200., 480.)]
    fn overlapping_same_voltage(#[case] start: f64, #[case] end: f64) {
        let mut infra_cache = create_small_infra_cache();

        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut electrification_1 = create_electrification_cache("Cat_error_1", track_ranges_1);
        electrification_1.voltage = "1500V".into();
        infra_cache.add(&electrification_1).unwrap();

        let track_ranges_2 = vec![("A", start, end)];
        let mut electrification_2 = create_electrification_cache("Cat_error_2", track_ranges_2);
        electrification_2.voltage = "1500V".into();
        infra_cache.add(&electrification_2).unwrap();

        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        let expected = InfraError::new_overlapping_electrifications("Cat_error_1", "Cat_error_2");

        assert_eq!(1, errors.len());
        assert_eq!(expected, errors[0]);
    }
}
