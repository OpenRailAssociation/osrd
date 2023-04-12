use std::collections::{HashMap, HashSet};

use rangemap::RangeMap;

use super::{GlobalErrorGenerator, NoContext};
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{
    ApplicableDirections, Direction, InfraError, OSRDIdentified, ObjectRef, ObjectType,
};

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_empty),
    ObjectErrorGenerator::new(1, check_speed_section_track_ranges),
];
pub const GLOBAL_GENERATORS: [GlobalErrorGenerator<NoContext>; 1] =
    [GlobalErrorGenerator::new(check_overlapping)];

/// Check if a track section has empty speed section
pub fn check_empty(speed_section: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let speed_section = speed_section.unwrap_speed_section();
    if speed_section.track_ranges.is_empty() {
        vec![InfraError::new_empty_object(speed_section, "track_ranges")]
    } else {
        vec![]
    }
}
/// Retrieve invalid refs and out of range errors for speed sections
pub fn check_speed_section_track_ranges(
    speed_section: &ObjectCache,
    infra_cache: &InfraCache,
    _: &Graph,
) -> Vec<InfraError> {
    let mut infra_errors = vec![];
    let speed_section = speed_section.unwrap_speed_section();
    for (index, track_range) in speed_section.track_ranges.iter().enumerate() {
        let track_id = &track_range.track;
        if !infra_cache
            .track_sections()
            .contains_key::<String>(track_id)
        {
            let obj_ref = ObjectRef::new::<&String>(ObjectType::TrackSection, track_id);
            infra_errors.push(InfraError::new_invalid_reference(
                speed_section,
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
                    speed_section,
                    format!("track_ranges.{index}.{field}"),
                    pos,
                    [0.0, track_cache.length],
                ));
            }
        }
    }
    infra_errors
}

fn get_directions(directions: ApplicableDirections) -> Vec<Direction> {
    match directions {
        ApplicableDirections::Both => vec![Direction::StartToStop, Direction::StopToStart],
        ApplicableDirections::StartToStop => vec![Direction::StartToStop],
        ApplicableDirections::StopToStart => vec![Direction::StopToStart],
    }
}

/// Checks that speed sections overlapping
pub fn check_overlapping(infra_cache: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let mut overlapping_sc = HashSet::new();
    // Key: (Track, Tag, Direction)
    //   - Tag is None for the default speed limit and Some for the tagged ones
    // Value: RangeMap<Range, SpeedSectionId>
    let mut range_maps: HashMap<(String, Option<String>, Direction), RangeMap<u64, String>> =
        Default::default();

    // Iterate over all the speed sections insure we don't report duplicated errors
    for speed_section in infra_cache.speed_sections().values() {
        let speed_section = speed_section.unwrap_speed_section();
        // Ignore LPV (they can overlap)
        if speed_section.extensions.lpv_sncf.is_some() {
            continue;
        }
        for track_range in speed_section.track_ranges.iter() {
            let range = (track_range.begin * 100.) as u64..(track_range.end * 100.) as u64;
            let track_id = &track_range.track.0;

            for direction in get_directions(track_range.applicable_directions) {
                // Handle the default speed limit if it exists
                if speed_section.speed_limit.is_some() {
                    let range_map = range_maps
                        .entry((track_id.clone(), None, direction))
                        .or_insert(Default::default());
                    for (_, overlap) in range_map.overlapping(&range) {
                        if speed_section.get_id() == overlap {
                            // Avoid reporting overlap with itself
                            continue;
                        }
                        overlapping_sc.insert((speed_section.get_id().clone(), overlap.clone()));
                    }
                    range_map.insert(range.clone(), speed_section.get_id().to_string());
                }
                // Handle all the tags
                for tag in speed_section.speed_limit_by_tag.keys() {
                    let range_map = range_maps
                        .entry((track_id.clone(), Some(tag.0.clone()), direction))
                        .or_default();
                    for (_, overlap) in range_map.overlapping(&range) {
                        if speed_section.get_id() == overlap {
                            // Avoid reporting overlap with itself
                            continue;
                        }
                        overlapping_sc.insert((speed_section.get_id().clone(), overlap.clone()));
                    }
                    range_map.insert(range.clone(), speed_section.get_id().to_string());
                }
            }
        }
    }

    // Map the overlapping speed sections to infra errors
    overlapping_sc
        .into_iter()
        .map(|(sc1, sc2)| InfraError::new_overlapping_speed_sections(sc1, sc2))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::check_speed_section_track_ranges;
    use super::InfraError;
    use crate::generated_data::error::speed_sections::check_overlapping;
    use crate::infra_cache::tests::{create_small_infra_cache, create_speed_section_cache};
    use crate::infra_cache::Graph;
    use crate::schema::{ObjectRef, ObjectType};

    #[test]
    fn invalid_ref() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 500.), ("E", 0., 500.), ("B", 0., 250.)];
        let speed_section = create_speed_section_cache("SP_error", track_ranges_error);
        infra_cache.add(speed_section.clone());
        let errors = check_speed_section_track_ranges(
            &speed_section.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let obj_ref = ObjectRef::new(ObjectType::TrackSection, "E");
        let infra_error =
            InfraError::new_invalid_reference(&speed_section, "track_ranges.1", obj_ref);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn out_of_range() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_error = vec![("A", 20., 530.), ("B", 0., 250.)];
        let speed_section = create_speed_section_cache("SP_error", track_ranges_error);
        infra_cache.add(speed_section.clone());
        let errors = check_speed_section_track_ranges(
            &speed_section.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        assert_eq!(1, errors.len());
        let infra_error =
            InfraError::new_out_of_range(&speed_section, "track_ranges.0.end", 530., [0.0, 500.]);
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_default() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut speed_section_1 = create_speed_section_cache("SP_error_1", track_ranges_1);
        speed_section_1.speed_limit = Some(42.);
        infra_cache.add(speed_section_1);
        let track_ranges_2 = vec![("A", 100., 150.), ("A", 200., 480.)];
        let mut speed_section_2 = create_speed_section_cache("SP_error_2", track_ranges_2);
        speed_section_2.speed_limit = Some(100.);
        infra_cache.add(speed_section_2);
        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_overlapping_speed_sections("SP_error_1", "SP_error_2");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_tags() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut speed_section_1 = create_speed_section_cache("SP_error_1", track_ranges_1);
        speed_section_1
            .speed_limit_by_tag
            .insert("my_tag".into(), 42.);
        infra_cache.add(speed_section_1);
        let track_ranges_2 = vec![("A", 100., 150.), ("A", 200., 480.)];
        let mut speed_section_2 = create_speed_section_cache("SP_error_2", track_ranges_2);
        speed_section_2
            .speed_limit_by_tag
            .insert("my_tag".into(), 100.);
        infra_cache.add(speed_section_2);
        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        assert_eq!(1, errors.len());
        let infra_error = InfraError::new_overlapping_speed_sections("SP_error_1", "SP_error_2");
        assert_eq!(infra_error, errors[0]);
    }

    #[test]
    fn overlapping_pass() {
        let mut infra_cache = create_small_infra_cache();
        let track_ranges_1 = vec![("A", 20., 220.)];
        let mut speed_section_1 = create_speed_section_cache("SP_error_1", track_ranges_1);
        speed_section_1.speed_limit = Some(42.);
        speed_section_1
            .speed_limit_by_tag
            .insert("my_tag_2".into(), 42.);
        infra_cache.add(speed_section_1);
        let track_ranges_2 = vec![("A", 100., 150.), ("A", 200., 480.)];
        let mut speed_section_2 = create_speed_section_cache("SP_error_2", track_ranges_2);
        speed_section_2
            .speed_limit_by_tag
            .insert("my_tag".into(), 100.);
        infra_cache.add(speed_section_2);
        let errors = check_overlapping(&infra_cache, &Graph::load(&infra_cache));
        assert_eq!(0, errors.len());
    }
}
