use std::collections::VecDeque;
use std::ops::Deref;
use std::ops::DerefMut;

use editoast_models::DbConnection;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models::Exists;
use crate::models::RollingStock;

use super::error::Error;

editoast_common::schemas! {
    Waypoint,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct Request {
    #[schema(inline)]
    pub rolling_stock: RollingStockCharacteristics,
    #[schema(value_type = Vec<SimilarScheduleWaypoint>)]
    pub waypoints: Vec<Waypoint>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RollingStockCharacteristics {
    pub name: String,
    pub speed_limit_tag: Option<String>,
}

impl RollingStockCharacteristics {
    pub async fn validate(
        &self,
        conn: &mut DbConnection,
        speed_limit_tag_ids: &SpeedLimitTagIds,
    ) -> Result<(), Error> {
        if !RollingStock::exists(conn, self.name.clone())
            .await
            .map_err(|_| Error::RollingStockNotFound)?
        {
            return Err(Error::RollingStockNotFound);
        }

        if self
            .speed_limit_tag
            .as_ref()
            .is_some_and(|tag| !speed_limit_tag_ids.contains(tag))
        {
            return Err(Error::SpeedLimitTagNotFound);
        }

        Ok(())
    }

    #[cfg(test)]
    fn new(name: String, speed_limit_tag: Option<String>) -> Self {
        Self {
            name,
            speed_limit_tag,
        }
    }
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypoint)]
pub struct Waypoint {
    pub ci: u32,
    pub ch: String,
    pub stop: bool,
}

impl Waypoint {
    #[cfg(test)]
    fn new(ci: u32, ch: String, stop: bool) -> Self {
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

#[derive(Debug, Clone)]
#[cfg_attr(test, derive(PartialEq))]
pub struct Segment(VecDeque<Waypoint>);

impl Segment {
    /// Splits the waypoints into segments between each stops
    ///
    /// The stop waypoint at the end of one segment is included in the next segment.
    ///
    /// # Panics
    ///
    /// The first and last provided waypoints must be stop waypoints.
    /// There must be at least two waypoints in the provided list. (duh)
    pub fn split_segments(waypoints: Vec<Waypoint>) -> Result<Vec<Segment>, Error> {
        if waypoints.len() < 2 {
            return Err(Error::NotEnoughWaypoints);
        }
        if !waypoints.last().unwrap().stop {
            return Err(Error::LastWaypointNotAStop);
        }

        let mut segments = Vec::<VecDeque<Waypoint>>::new();
        for waypoint in waypoints {
            if waypoint.stop {
                if let Some(last_segment) = segments.last_mut() {
                    last_segment.push_back(waypoint.clone());
                }
                segments.push(VecDeque::from([waypoint]));
            } else if let Some(last_segment) = segments.last_mut() {
                last_segment.push_back(waypoint);
            } else {
                return Err(Error::FirstWaypointNotAStop);
            }
        }

        if segments.last().map(|s| s.len()) == Some(1) {
            segments.pop();
        }

        Ok(segments.into_iter().map(Segment).collect())
    }

    pub fn start(&self) -> Result<&Waypoint, Error> {
        self.front().ok_or(Error::EmptySegment)
    }

    pub fn end(&self) -> Result<&Waypoint, Error> {
        self.back().ok_or(Error::EmptySegment)
    }
}

impl Deref for Segment {
    type Target = VecDeque<Waypoint>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Segment {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;

    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::fixtures::simple_rolling_stock;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
    use crate::models::Changeset;
    use crate::models::Create;
    use crate::models::RollingStock;

    use super::Error;
    use super::RollingStockCharacteristics;
    use super::Segment;
    use super::Waypoint;

    #[test]
    fn test_split_segments_valid() {
        let waypoints = vec![
            Waypoint::new(1, "1".into(), true),
            Waypoint::new(2, "2".into(), false),
            Waypoint::new(3, "3".into(), true),
            Waypoint::new(4, "4".into(), false),
            Waypoint::new(5, "5".into(), true),
        ];

        let expected_segments = vec![
            Segment(VecDeque::from([
                Waypoint::new(1, "1".into(), true),
                Waypoint::new(2, "2".into(), false),
                Waypoint::new(3, "3".into(), true),
            ])),
            Segment(VecDeque::from([
                Waypoint::new(3, "3".into(), true),
                Waypoint::new(4, "4".into(), false),
                Waypoint::new(5, "5".into(), true),
            ])),
        ];

        let result = Segment::split_segments(waypoints).unwrap();
        assert_eq!(result, expected_segments);
    }

    #[test]
    fn test_split_segments_minimum_input() {
        let waypoints = vec![
            Waypoint::new(1, "1".into(), true),
            Waypoint::new(2, "2".into(), true),
        ];

        let expected_segments = vec![Segment(VecDeque::from([
            Waypoint::new(1, "1".into(), true),
            Waypoint::new(2, "2".into(), true),
        ]))];

        let result = Segment::split_segments(waypoints).unwrap();
        assert_eq!(result, expected_segments);
    }

    #[test]
    fn test_split_segments_only_stops() {
        let waypoints = vec![
            Waypoint::new(1, "1".into(), true),
            Waypoint::new(2, "2".into(), true),
            Waypoint::new(3, "3".into(), true),
        ];

        let expected_segments = vec![
            Segment(VecDeque::from([
                Waypoint::new(1, "1".into(), true),
                Waypoint::new(2, "2".into(), true),
            ])),
            Segment(VecDeque::from([
                Waypoint::new(2, "2".into(), true),
                Waypoint::new(3, "3".into(), true),
            ])),
        ];

        let result = Segment::split_segments(waypoints).unwrap();
        assert_eq!(result, expected_segments);
    }

    #[test]
    fn test_split_segments_not_enough_waypoints() {
        let waypoints = vec![Waypoint::new(1, "1".into(), true)];
        let result = Segment::split_segments(waypoints);
        assert_eq!(result, Err(Error::NotEnoughWaypoints));
    }

    #[test]
    fn test_split_segments_first_not_stop() {
        let waypoints = vec![
            Waypoint::new(1, "1".into(), false),
            Waypoint::new(2, "2".into(), true),
        ];
        let result = Segment::split_segments(waypoints);
        assert_eq!(result, Err(Error::FirstWaypointNotAStop));
    }

    #[test]
    fn test_split_segments_last_not_stop() {
        let waypoints = vec![
            Waypoint::new(1, "1".into(), true),
            Waypoint::new(2, "2".into(), false),
        ];
        let result = Segment::split_segments(waypoints);
        assert_eq!(result, Err(Error::LastWaypointNotAStop));
    }

    #[rstest]
    async fn test_validate_rolling_stock_exists_no_speed_limit_tag() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_changeset: Changeset<RollingStock> = simple_rolling_stock().into();
        let rolling_stock = rolling_stock_changeset
            .version(1)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        let rolling_stock_characteristics =
            RollingStockCharacteristics::new(rolling_stock.name, None);

        assert!(
            rolling_stock_characteristics
                .validate(&mut db_pool.get_ok(), &SpeedLimitTagIds::load())
                .await
                .is_ok(),
        );
    }

    #[rstest]
    async fn test_validate_rolling_stock_exists_valid_speed_limit_tag() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_changeset: Changeset<RollingStock> = simple_rolling_stock().into();
        let rolling_stock = rolling_stock_changeset
            .version(1)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let rolling_stock_characteristics =
            RollingStockCharacteristics::new(rolling_stock.name, Some("V140".to_string()));

        assert!(
            rolling_stock_characteristics
                .validate(&mut db_pool.get_ok(), &SpeedLimitTagIds::load())
                .await
                .is_ok(),
        );
    }

    #[rstest]
    async fn test_validate_rolling_stock_not_found() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_characteristics =
            RollingStockCharacteristics::new("non_existent_rolling_stock".to_string(), None);

        let result = rolling_stock_characteristics
            .validate(&mut db_pool.get_ok(), &SpeedLimitTagIds::load())
            .await;

        assert_eq!(result, Err(Error::RollingStockNotFound),);
    }

    #[rstest]
    async fn test_validate_invalid_speed_limit_tag() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_changeset: Changeset<RollingStock> = simple_rolling_stock().into();
        let rolling_stock = rolling_stock_changeset
            .version(1)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");

        let rolling_stock_characteristics =
            RollingStockCharacteristics::new(rolling_stock.name, Some("invalid_tag".to_string()));

        let result = rolling_stock_characteristics
            .validate(&mut db_pool.get_ok(), &SpeedLimitTagIds::load())
            .await;

        assert_eq!(result, Err(Error::SpeedLimitTagNotFound),);
    }

    #[test]
    fn test_empty_vec() {
        let input = vec![];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, vec![]);
    }

    #[test]
    fn test_single_waypoint() {
        let input = vec![Waypoint::new(1, "A".to_string(), true)];
        let result = Waypoint::squash_successive_waypoints(input.clone());
        assert_eq!(result, input);
    }

    #[test]
    fn test_no_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_string(), true),
            Waypoint::new(2, "B".to_string(), false),
            Waypoint::new(3, "C".to_string(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input.clone());
        assert_eq!(result, input);
    }

    #[test]
    fn test_consecutive_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_string(), true),
            Waypoint::new(1, "A".to_string(), false),
            Waypoint::new(1, "A".to_string(), false),
            Waypoint::new(2, "B".to_string(), true),
        ];
        let expected = vec![
            Waypoint::new(1, "A".to_string(), true),
            Waypoint::new(2, "B".to_string(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, expected);
    }

    #[test]
    fn test_non_consecutive_duplicates() {
        let input = vec![
            Waypoint::new(1, "A".to_string(), true),
            Waypoint::new(2, "B".to_string(), false),
            Waypoint::new(1, "A".to_string(), false),
            Waypoint::new(3, "C".to_string(), true),
        ];
        let expected = vec![
            Waypoint::new(1, "A".to_string(), true),
            Waypoint::new(2, "B".to_string(), false),
            Waypoint::new(1, "A".to_string(), false),
            Waypoint::new(3, "C".to_string(), true),
        ];
        let result = Waypoint::squash_successive_waypoints(input);
        assert_eq!(result, expected);
    }
}
