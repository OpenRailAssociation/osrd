use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use itertools::Either;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::reference_schedule)]
#[model(gen(batch_ops = c, list))]
pub struct ReferenceSchedule {
    pub id: i64,
    pub train_schedule: i64,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub traction_engine: String,
    pub towed_rolling_stock: Option<String>,
    pub speed_limit_tag: Option<String>,
    pub weight: Option<i64>,
    pub stop_points_ci: Vec<Option<i64>>,
    #[model(json)]
    pub waypoints: Vec<Waypoint>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct Waypoint {
    pub ci: i64,
    pub ch: Option<String>,
    pub stop: bool,
}

impl ReferenceSchedule {
    pub fn rank(&self, waypoint: &Waypoint) -> Option<usize> {
        self.waypoints.iter().position(|w| w == waypoint)
    }

    pub fn find_waypoint(&self, ci: i64, ch: Option<&String>) -> Option<Waypoint> {
        self.waypoints
            .iter()
            .find(|w| w.ci == ci && w.ch.as_ref() == ch)
            .cloned()
    }

    pub fn inside_segment(
        self,
        first_waypoint: &Waypoint,
        last_waypoint: &Waypoint,
    ) -> Result<Either<Self, ()>, ()> {
        let Some(first) = self.rank(first_waypoint) else {
            return Err(());
        };
        let Some(last) = self.rank(last_waypoint) else {
            return Err(());
        };
        if first >= last {
            return Ok(Either::Right(()));
        }

        let waypoints: Vec<Waypoint> = self
            .waypoints
            .into_iter()
            .skip(first)
            .take(last - first + 1)
            .collect();

        Ok(Either::Left(Self {
            id: self.id,
            train_schedule: self.train_schedule,
            name: self.name,
            start_date: self.start_date,
            traction_engine: self.traction_engine,
            towed_rolling_stock: self.towed_rolling_stock,
            speed_limit_tag: self.speed_limit_tag,
            weight: self.weight,
            stop_points_ci: self.stop_points_ci,
            waypoints,
        }))
    }
}
