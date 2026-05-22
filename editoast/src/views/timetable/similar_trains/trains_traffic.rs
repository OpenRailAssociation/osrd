use crate::error::Result;
use crate::views::timetable::similar_trains::OperationalPoint;
use crate::views::timetable::similar_trains::PastTrain;
use crate::views::timetable::similar_trains::past_train::Id;
use arcstr::ArcStr;
use chrono::DateTime;
use chrono::Months;

use chrono::Utc;
use itertools::Itertools;
use serde::Deserialize;
use std::collections::HashMap;
use std::collections::HashSet;

use super::graph;

#[derive(Clone, Debug)]
pub struct TrainTraffic {
    pub(super) name: String,
    pub(super) start_time: DateTime<Utc>,
    pub(super) rolling_stock: String,
    pub(super) speed_limit_tag: String,
    pub(super) train: PastTrain,
}

#[derive(Debug, Deserialize, Clone, Hash, PartialEq, Eq)]
pub struct TrainOperationalPoint {
    pub id: String,
    pub stop: Option<bool>,
}

impl TrainTraffic {
    pub fn new(
        id: Id,
        name: String,
        start_time: DateTime<Utc>,
        rolling_stock: String,
        speed_limit_tag: String,
        waypoints: Vec<TrainOperationalPoint>,
    ) -> Self {
        let nb_waypoints = waypoints.len();
        let mut waypoints_graph = Vec::<graph::Waypoint>::with_capacity(nb_waypoints);
        for (index, waypoint) in waypoints.iter().enumerate() {
            if let Some(prev) = waypoints_graph.last_mut()
                && prev.op.to_string() == waypoint.id
            {
                prev.stop |= waypoint.stop.unwrap_or(false);
                continue;
            }
            waypoints_graph.push(graph::Waypoint {
                op: OperationalPoint(ArcStr::from(waypoint.id.clone())),
                stop: if index == 0 || index == (nb_waypoints - 1) {
                    true
                } else {
                    waypoint.stop.unwrap_or(false)
                },
            });
        }

        Self {
            name,
            start_time,
            rolling_stock,
            speed_limit_tag,
            train: PastTrain::new(id, waypoints_graph),
        }
    }

    pub fn id(&self) -> Id {
        self.train.id()
    }
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct Segment {
    from: graph::Waypoint,
    to: graph::Waypoint,
}

#[derive(Clone, Debug, Default)]
pub struct TrainsTrafficPool {
    // Date from which traffic are valid (ie. can be imported)
    traffic_valid_from: DateTime<Utc>,
    // Trains by speed limit
    trains_by_speed_limit: HashMap<String, HashSet<usize>>,
    // Trains by rolling stock
    trains_by_rolling_stock: HashMap<String, HashSet<usize>>,
    // Trains by segment
    trains_by_segment: HashMap<Segment, HashSet<usize>>,
    // Train by ID
    trains_by_id: HashMap<Id, TrainTraffic>,
}

impl TrainsTrafficPool {
    pub fn new() -> Self {
        TrainsTrafficPool::new_with_date(
            Utc::now()
                .checked_sub_months(Months::new(6))
                .expect("6 month ago date should be valid"),
        )
    }

    pub fn new_with_date(traffic_valid_from: DateTime<Utc>) -> Self {
        Self {
            traffic_valid_from,
            ..Default::default()
        }
    }

    pub fn len(&self) -> usize {
        self.trains_by_id.len()
    }

    /// Retrieve a train by its id
    pub fn get_by_id(&self, id: usize) -> Option<TrainTraffic> {
        self.trains_by_id.get(&id).cloned()
    }

    /// Add a train traffic
    pub fn add_train_traffic(&mut self, train_data: TrainTraffic) -> Result<()> {
        // Only import train that have a valid start date
        if train_data.start_time > self.traffic_valid_from {
            // Index the train by its speed limit
            self.trains_by_speed_limit
                .entry(train_data.speed_limit_tag.clone())
                .or_default()
                .insert(train_data.id());

            // Index the train by its rolling stock
            self.trains_by_rolling_stock
                .entry(train_data.rolling_stock.clone())
                .or_default()
                .insert(train_data.id());

            // Index the train by segment
            for (from, to) in train_data.train.iter_stops().tuple_windows() {
                self.trains_by_segment
                    .entry(Segment {
                        from: from.clone(),
                        to: to.clone(),
                    })
                    .or_default()
                    .insert(train_data.id());
            }

            // Index the train by its id
            if self.trains_by_id.contains_key(&train_data.id()) {
                tracing::warn!(
                    train_id = train_data.id(),
                    "Train already exist, overriding it"
                );
            }
            self.trains_by_id.insert(train_data.id(), train_data);
        }

        Ok(())
    }

    /// Find in the traffic a composition of trains that match the given train itinerary
    pub(super) fn find_compatible_trains(
        &self,
        rolling_stock: Option<String>,
        speed_limit_tag: Option<String>,
        waypoints: impl IntoIterator<Item = graph::Waypoint>,
    ) -> Vec<TrainTraffic> {
        let mut valid_trains = HashSet::<usize>::new();

        // Getting a list of valid train Ids which match the train's specifications
        let compliant_trains = match (rolling_stock, speed_limit_tag) {
            (Some(rs), None) => self
                .trains_by_rolling_stock
                .get(&rs)
                .cloned()
                .unwrap_or_default(),
            (None, Some(speed)) => self
                .trains_by_speed_limit
                .get(&speed)
                .cloned()
                .unwrap_or_default(),
            (Some(rs), Some(speed)) => {
                let rs_trains = self
                    .trains_by_rolling_stock
                    .get(&rs)
                    .cloned()
                    .unwrap_or_default();
                let speed_trains = self
                    .trains_by_speed_limit
                    .get(&speed)
                    .cloned()
                    .unwrap_or_default();
                rs_trains.intersection(&speed_trains).cloned().collect()
            }
            (None, None) => unreachable!("Should not be reachable, checked at the API level"),
        };

        tracing::debug!(
            nb_train = compliant_trains.len(),
            "Compliant trains by specifications"
        );

        for (from, to) in waypoints.into_iter().filter(|w| w.stop).tuple_windows() {
            let trains_in_segment = self.trains_by_segment.get(&Segment { from, to });
            if let Some(ids) = trains_in_segment {
                for index in ids {
                    if compliant_trains.contains(index) {
                        valid_trains.insert(*index);
                    }
                }
            }
        }

        tracing::debug!(nb_train = valid_trains.len(), "Compliant trains");

        valid_trains
            .iter()
            .map(|train_id| {
                self.trains_by_id
                    .get(train_id)
                    .expect("Bad consistency in train traffic indices")
                    .clone()
            })
            .collect()
    }
}

#[cfg(test)]
pub mod tests {
    use chrono::DateTime;
    use chrono::Utc;
    use std::str::FromStr;

    use super::graph;
    use crate::views::timetable::similar_trains::OperationalPoint;
    use crate::views::timetable::similar_trains::PastTrain;
    use crate::views::timetable::similar_trains::trains_traffic::Segment;
    use crate::views::timetable::similar_trains::trains_traffic::TrainTraffic;

    use super::TrainsTrafficPool;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn load_traffic_file() {
        let valid_traffic_date =
            DateTime::<Utc>::from_str("2025-03-01T00:00:00Z").expect("Date should be valid");

        let mut traffic = TrainsTrafficPool::new_with_date(valid_traffic_date);
        let operational_points = vec![
            graph::Waypoint {
                op: OperationalPoint("A".into()),
                stop: true,
            },
            graph::Waypoint {
                op: OperationalPoint("B".into()),
                stop: false,
            },
            graph::Waypoint {
                op: OperationalPoint("C".into()),
                stop: true,
            },
            graph::Waypoint {
                op: OperationalPoint("D".into()),
                stop: true,
            },
        ];
        traffic
            .add_train_traffic(TrainTraffic {
                name: "TEST_123".to_string(),
                start_time: DateTime::<Utc>::from_str("2025-03-26T00:00:00Z")
                    .expect("Date should be valid"),
                rolling_stock: "RS_V1".to_string(),
                speed_limit_tag: "MA100".to_string(),
                train: PastTrain::new(0, operational_points.clone()),
            })
            .expect("Train TEST_123 should be imported");
        traffic
            .add_train_traffic(TrainTraffic {
                name: "TEST_321".to_string(),
                start_time: DateTime::<Utc>::from_str("2025-07-14T00:00:00Z")
                    .expect("Date should be valid"),
                rolling_stock: "RS_V2".to_string(),
                speed_limit_tag: "MA100".to_string(),
                train: PastTrain::new(1, operational_points.clone()),
            })
            .expect("Train TEST_321 should be imported");
        traffic
            .add_train_traffic(TrainTraffic {
                name: "OUTDATED".to_string(),
                start_time: DateTime::<Utc>::from_str("2025-02-01T00:00:00Z")
                    .expect("Date should be valid"),
                rolling_stock: "RS_V2".to_string(),
                speed_limit_tag: "MA100".to_string(),
                train: PastTrain::new(2, operational_points.clone()),
            })
            .expect("Train OUTDATED should be imported");

        // Checking that train traffic are loaded
        assert_eq!(traffic.len(), 2);

        let train_123 = traffic.get_by_id(0).expect("TEST_123 should be imported");
        assert_eq!(train_123.name, "TEST_123");
        assert_eq!(train_123.rolling_stock, "RS_V1");
        assert_eq!(train_123.speed_limit_tag, "MA100");
        assert_eq!(
            train_123.start_time,
            DateTime::<Utc>::from_str("2025-03-26T00:00:00Z").expect("Date should be valid")
        );

        let train_321 = traffic.get_by_id(1).expect("TEST_321 should be imported");
        assert_eq!(train_321.name, "TEST_321");
        assert_eq!(train_321.rolling_stock, "RS_V2");
        assert_eq!(train_321.speed_limit_tag, "MA100");
        assert_eq!(
            train_321.start_time,
            DateTime::<Utc>::from_str("2025-07-14T00:00:00Z").expect("Date should be valid")
        );

        // Checking the inner indices
        assert_eq!(
            traffic.trains_by_rolling_stock.get("RS_V1").unwrap().len(),
            1
        );
        assert_eq!(
            traffic.trains_by_rolling_stock.get("RS_V2").unwrap().len(),
            1
        );
        assert_eq!(traffic.trains_by_speed_limit.get("MA100").unwrap().len(), 2);

        // trains_by_segment index should contains A->C & C->D, but not A->B
        assert_eq!(
            traffic
                .trains_by_segment
                .get(&Segment {
                    from: graph::Waypoint {
                        op: OperationalPoint("A".into()),
                        stop: true
                    },
                    to: graph::Waypoint {
                        op: OperationalPoint("C".into()),
                        stop: true
                    },
                })
                .expect("Segment should exist")
                .len(),
            2
        );
        assert_eq!(
            traffic
                .trains_by_segment
                .get(&Segment {
                    from: graph::Waypoint {
                        op: OperationalPoint("C".into()),
                        stop: true
                    },
                    to: graph::Waypoint {
                        op: OperationalPoint("D".into()),
                        stop: true
                    },
                })
                .expect("Segment should exist")
                .len(),
            2
        );
        assert!(!traffic.trains_by_segment.contains_key(&Segment {
            from: graph::Waypoint {
                op: OperationalPoint("A".into()),
                stop: true
            },
            to: graph::Waypoint {
                op: OperationalPoint("B".into()),
                stop: true
            },
        }));
    }
}
