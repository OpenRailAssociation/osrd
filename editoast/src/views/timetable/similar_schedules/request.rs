use serde::Deserialize;
use smol_str::SmolStr;
use utoipa::ToSchema;

editoast_common::schemas! {
    Waypoint,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RollingStockCharacteristics {
    pub name: String,
    pub speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypoint)]
pub struct Waypoint {
    pub ci: u64,
    #[schema(value_type = String)]
    pub ch: SmolStr,
    pub stop: bool,
}

impl Waypoint {
    #[cfg(test)]
    fn new(ci: u64, ch: SmolStr, stop: bool) -> Self {
        Self { ci, ch, stop }
    }

    pub fn squash_successive_waypoints(waypoints: Vec<Waypoint>) -> Vec<Waypoint> {
        let mut result = Vec::<Waypoint>::with_capacity(waypoints.len());
        for waypoint in waypoints {
            if let Some(prev) = result.last_mut() {
                if prev.ci == waypoint.ci && prev.ch == waypoint.ch {
                    prev.stop |= waypoint.stop;
                    continue;
                }
            }
            result.push(waypoint);
        }
        result
    }
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}:{}{}",
            self.ci,
            self.ch,
            if self.stop { "[STOP]" } else { "" },
        )
    }
}

#[derive(Debug, Deserialize, ToSchema)]

pub struct Request {
    #[schema(inline)]
    pub rolling_stock: RollingStockCharacteristics,
    #[schema(value_type = Vec<SimilarScheduleWaypoint>)]
    pub waypoints: Vec<Waypoint>,
    pub infra_id: Option<i64>,
    pub timetable_id: Option<i64>,
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use smol_str::ToSmolStr;

    use super::Waypoint;

    #[test]
    fn test_empty_vec() {
        let input = vec![];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, vec![]);
    }

    #[test]
    fn test_single_waypoint() {
        let input = vec![Waypoint::new(1, "A".to_smolstr(), true)];
        let result = Waypoint::squash_successive_waypoints(input.clone());
        assert_eq!(result, input);
    }

    #[test]
    fn test_no_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_smolstr(), true),
            Waypoint::new(2, "B".to_smolstr(), false),
            Waypoint::new(3, "C".to_smolstr(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input.clone());
        assert_eq!(result, input);
    }

    #[test]
    fn test_consecutive_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_smolstr(), true),
            Waypoint::new(1, "A".to_smolstr(), false),
            Waypoint::new(1, "A".to_smolstr(), false),
            Waypoint::new(2, "B".to_smolstr(), true),
        ];
        let expected = vec![
            Waypoint::new(1, "A".to_smolstr(), true),
            Waypoint::new(2, "B".to_smolstr(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_non_consecutive_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_smolstr(), true),
            Waypoint::new(2, "B".to_smolstr(), false),
            Waypoint::new(1, "A".to_smolstr(), false),
            Waypoint::new(3, "C".to_smolstr(), true),
        ];
        let expected = vec![
            Waypoint::new(1, "A".to_smolstr(), true),
            Waypoint::new(2, "B".to_smolstr(), false),
            Waypoint::new(1, "A".to_smolstr(), false),
            Waypoint::new(3, "C".to_smolstr(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, expected);
    }
}
