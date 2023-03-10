use super::NoContext;
use crate::generated_data::error::ObjectErrorGenerator;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::InfraError;

pub const OBJECT_GENERATORS: [ObjectErrorGenerator<NoContext>; 2] = [
    ObjectErrorGenerator::new(1, check_slope_out_of_range),
    ObjectErrorGenerator::new(1, check_curve_out_of_range),
];

/// Retrieve slopes out of range
pub fn check_slope_out_of_range(track: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let track = track.unwrap_track_section();
    let track_length = track.length;
    let mut errors = vec![];
    for (index, slope) in track.slopes.iter().enumerate() {
        for (pos, field) in [(slope.begin, "begin"), (slope.end, "end")] {
            if !(0.0..=track_length).contains(&pos) {
                errors.push(InfraError::new_out_of_range(
                    track,
                    format!("slopes.{index}.{field}"),
                    pos,
                    [0.0, track_length],
                ));
            }
        }
    }
    errors
}

/// Retrieve curves out of range
pub fn check_curve_out_of_range(track: &ObjectCache, _: &InfraCache, _: &Graph) -> Vec<InfraError> {
    let track = track.unwrap_track_section();
    let track_length = track.length;
    let mut errors = vec![];
    for (index, curve) in track.curves.iter().enumerate() {
        for (pos, field) in [(curve.begin, "begin"), (curve.end, "end")] {
            if !(0.0..=track_length).contains(&pos) {
                errors.push(InfraError::new_out_of_range(
                    track,
                    format!("curves.{index}.{field}"),
                    pos,
                    [0.0, track_length],
                ));
            }
        }
    }
    errors
}

#[cfg(test)]
mod tests {
    use super::InfraError;
    use super::{check_curve_out_of_range, check_slope_out_of_range};
    use crate::infra_cache::tests::{create_small_infra_cache, create_track_section_cache};
    use crate::infra_cache::Graph;
    use crate::schema::{Curve, Slope};
    use ntest::test_case;

    #[test_case(50., false)]
    #[test_case(110., true)]
    fn slope_out_of_range(pos: f64, error: bool) {
        let mut infra_cache = create_small_infra_cache();
        let mut track = create_track_section_cache("S_error", 100.);
        track.slopes = vec![Slope {
            begin: 0.,
            end: pos,
            gradient: 0.1,
        }];
        infra_cache.add(track.clone());
        let errors = check_slope_out_of_range(
            &track.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        if error {
            assert_eq!(errors.len(), 1);
            let infra_error = InfraError::new_out_of_range(&track, "slopes.0.end", pos, [0., 100.]);
            assert_eq!(infra_error, errors[0]);
        } else {
            assert_eq!(errors.len(), 0);
        }
    }

    #[test_case(50., false)]
    #[test_case(110., true)]
    fn curve_out_of_range(pos: f64, error: bool) {
        let mut infra_cache = create_small_infra_cache();
        let mut track = create_track_section_cache("S_error", 100.);
        track.curves = vec![Curve {
            begin: 0.,
            end: pos,
            radius: 0.1,
        }];
        infra_cache.add(track.clone());
        let errors = check_curve_out_of_range(
            &track.clone().into(),
            &infra_cache,
            &Graph::load(&infra_cache),
        );
        if error {
            assert_eq!(errors.len(), 1);
            let infra_error = InfraError::new_out_of_range(&track, "curves.0.end", pos, [0., 100.]);
            assert_eq!(infra_error, errors[0]);
        } else {
            assert_eq!(errors.len(), 0);
        }
    }
}
