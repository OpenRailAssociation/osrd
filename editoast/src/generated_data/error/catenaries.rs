use std::collections::{HashMap, HashSet};

use rangemap::RangeMap;

use super::{GlobalErrorGenerator, NoContext};
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, OSRDIdentified, ObjectRef, ObjectType};

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_empty),
    ObjectErrorGenerator::new(1, check_catenary_track_ranges),
];

pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<NoContext>; 1] =
    [GlobalErrorGenerator::new(check_overlapping)];

/// Check if a track section has empty catenary
pub fn check_empty(catenary: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let catenary = catenary.unwrap_catenary();
    if catenary.track_ranges.is_empty() {
        vec![InfraError::new_empty_object(catenary, "track_ranges")]
    } else {
        vec![]
    }
}
/// Retrieve invalid refs and out of range errors for speed sections
pub fn check_catenary_track_ranges(
    catenary: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let catenary = catenary.unwrap_catenary();
    for (index, track_range) in catenary.track_ranges.iter().enumerate() {
        let track_id = &track_range.track;
        if !infra_cache
            .track_sections()
            .contains_key::<String>(track_id)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, track_id);
            infra_errors.push(InfraError::new_invalid_reference(
                catenary,
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
                    catenary,
                    format!("track_ranges.{index}.{field}"),
                    pos,
                    [0.0, track_cache.length],
                ));
            }
        }
    }
    infra_errors
}

/// Checks that catenaries don't overlap
pub fn check_overlapping(infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let mut overlapping_cat = HashSet::new();
    // Key: (Track, Voltage)
    // Value: RangeMap<Range, CatenaryId>
    let mut range_maps: HashMap<String, RangeMap<u64, String>> = Default::default();

    // Iterate over all the catenaries ensure we don't report duplicated errors
    for catenary in infra_cache.catenaries().values() {
        let catenary = catenary.unwrap_catenary();

        for track_range in catenary.track_ranges.iter() {
            let range = (track_range.begin * 100.) as u64..(track_range.end * 100.) as u64;
            let track_id = &track_range.track.0;

            let range_map = range_maps.entry(track_id.clone()).or_default();
            for (_, overlap) in range_map.overlapping(&range) {
                if catenary.get_id() == overlap {
                    // Avoid reporting overlap with itself
                    continue;
                }
                overlapping_cat.insert((catenary.get_id().clone(), overlap.clone()));
            }
            range_map.insert(range.clone(), catenary.get_id().to_string());
        }
    }

    // Map the overlapping catenaries to infra errors
    overlapping_cat
        .into_iter()
        .map(|(sc1, sc2)| InfraError::new_overlapping_catenaries(sc1, sc2))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::check_catenary_track_ranges;
    use super::InfraError;
    use crate::generated_data::error::catenaries::check_overlapping;
    use crate::infra_cache::tests::create_catenary_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::Graph;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        let catenary = create_catenary_cache("Cat_error", track_ranges_error);
        infra_cache.add(catenary.clone());
        let errors = check_catenary_track_ranges(
            &catenary.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error = InfraError::new_invalid_reference(&catenary, "track_ranges.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        let catenary = create_catenary_cache("Cat_error", track_ranges_error);
        infra_cache.add(catenary.clone());
        let errors = check_catenary_track_ranges(
            &catenary.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_out_of_range(&catenary, "track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_default() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut catenary_1 = create_catenary_cache("Cat_error_1", track_ranges_1);
        catenary_1.voltage = "1500".into();
        infra_cache.add(catenary_1);
        let track_ranges_2 = vec![("A", 100., 150.), ("A", 200., 480.)];
        let mut catenary_2 = create_catenary_cache("Cat_error_2", track_ranges_2);
        catenary_2.voltage = "25000".into();
        infra_cache.add(catenary_2);
        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_overlapping_catenaries("Cat_error_1", "Cat_error_2");
        assert_eq!(infra_error, errors[0]);
    }
}
