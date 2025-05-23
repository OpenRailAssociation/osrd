use std::ops::DerefMut;

use crate::models::prelude::*;
use chrono::DateTime;
use chrono::Utc;
use diesel::sql_query;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use editoast_models::DatabaseError;
use editoast_models::DbConnection;
use editoast_models::rolling_stock::TrainCategory;
use editoast_schemas;
use editoast_schemas::primitives::NonBlankString;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleOptions;

#[derive(Debug, Default, Clone, Model)]
#[model(table = editoast_models::tables::train_schedule)]
#[model(gen(ops = crud, batch_ops = crd, list))]
#[model(row(derive(diesel::QueryableByName)))]
pub struct TrainSchedule {
    pub id: i64,
    pub train_name: String,
    pub labels: Vec<Option<String>>,
    pub rolling_stock_name: String,
    pub timetable_id: i64,
    pub start_time: DateTime<Utc>,
    #[model(json)]
    pub schedule: Vec<ScheduleItem>,
    #[model(json)]
    pub margins: Margins,
    pub initial_speed: f64,
    #[model(to_enum)]
    pub comfort: Comfort,
    #[model(json)]
    pub path: Vec<PathItem>,
    #[model(to_enum)]
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    #[model(json)]
    pub power_restrictions: Vec<PowerRestrictionItem>,
    #[model(json)]
    pub options: TrainScheduleOptions,
    pub category: Option<TrainCategory>,
}

impl TrainSchedule {
    pub async fn get_by_rolling_stock_name_and_speed_limit_tag(
        conn: DbConnection,
        rolling_stock_name: String,
        speed_limit_tag: Option<String>,
    ) -> Result<Vec<TrainSchedule>, DatabaseError> {
        let result = sql_query(
            "SELECT * FROM train_schedule
            WHERE rolling_stock_name = $1
            AND ($2 IS NULL OR speed_limit_tag = $2)",
        )
        .bind::<Text, _>(rolling_stock_name)
        .bind::<Nullable<Text>, _>(speed_limit_tag)
        .get_results::<TrainScheduleRow>(conn.write().await.deref_mut())
        .await;

        match result {
            Ok(result) => Ok(result.into_iter().map(Into::into).collect()),
            Err(err) => Err(err.into()),
        }
    }

    fn stop_at(&self, path_item_id: &NonBlankString) -> bool {
        self.schedule.iter().any(|schedule_item| {
            schedule_item.at == *path_item_id && schedule_item.stop_for.is_some()
        })
    }

    /// Checks if the schedule contains two stops (start and end) in the correct order,
    /// and that there are no other stops in between.
    pub fn contains_stops_in_order(&self, start_uic: u32, end_uic: u32) -> bool {
        let mut found_first = false;

        for path_item in &self.path {
            if let Some(uic) = path_item.get_uic() {
                if self.stop_at(&path_item.id) {
                    if uic == start_uic {
                        found_first = true;
                    } else if found_first && uic != end_uic {
                        return false;
                    } else if uic == end_uic && found_first {
                        return true;
                    }
                }
            }
        }

        false
    }
}

impl From<editoast_schemas::TrainSchedule> for TrainScheduleChangeset {
    fn from(
        editoast_schemas::TrainSchedule {
            train_name,
            labels,
            rolling_stock_name,
            start_time,
            path,
            schedule,
            margins,
            initial_speed,
            comfort,
            constraint_distribution,
            speed_limit_tag,
            power_restrictions,
            options,
            category,
        }: editoast_schemas::TrainSchedule,
    ) -> Self {
        TrainSchedule::changeset()
            .comfort(comfort)
            .constraint_distribution(constraint_distribution)
            .initial_speed(initial_speed)
            .labels(labels.into_iter().map(Some).collect())
            .margins(margins)
            .path(path)
            .power_restrictions(power_restrictions)
            .rolling_stock_name(rolling_stock_name)
            .schedule(schedule)
            .speed_limit_tag(speed_limit_tag.map(|s| s.0))
            .start_time(start_time)
            .train_name(train_name)
            .options(options)
            .category(category.map(TrainCategory))
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use editoast_schemas::infra::TrackOffset;
    use editoast_schemas::primitives::PositiveDuration;
    use editoast_schemas::train_schedule::OperationalPointIdentifier;
    use editoast_schemas::train_schedule::OperationalPointReference;
    use editoast_schemas::train_schedule::PathItem;
    use editoast_schemas::train_schedule::PathItemLocation;
    use editoast_schemas::train_schedule::ScheduleItem;

    use super::TrainSchedule;

    fn create_path_item_uic(id: &str, uic: u32) -> PathItem {
        let location = PathItemLocation::OperationalPointReference(OperationalPointReference {
            reference: OperationalPointIdentifier::OperationalPointUic {
                uic,
                secondary_code: None,
            },
            track_reference: None,
        });
        PathItem::new(id.to_string(), location)
    }

    fn create_schedule_item(id: &str) -> ScheduleItem {
        ScheduleItem {
            at: id.into(),
            stop_for: Some(PositiveDuration::try_from(Duration::zero()).unwrap()),
            ..Default::default()
        }
    }

    fn create_path_item_track_offset(id: &str) -> PathItem {
        let location = PathItemLocation::TrackOffset(TrackOffset::new("track", 0));
        PathItem::new(id.to_string(), location)
    }

    #[test]
    fn test_stops_in_order() {
        let path = vec![
            create_path_item_uic("1", 1),
            create_path_item_uic("2", 2),
            create_path_item_uic("3", 3),
        ];
        let schedule = vec![create_schedule_item("1"), create_schedule_item("3")];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };
        assert!(train_schedule.contains_stops_in_order(1, 3));
    }

    #[test]
    fn test_contains_stops_in_order_with_multiple_scheduled_stops() {
        let path = vec![
            create_path_item_uic("1", 1),
            create_path_item_uic("2", 2),
            create_path_item_uic("3", 3),
            create_path_item_uic("4", 4),
            create_path_item_uic("5", 5),
            create_path_item_uic("6", 6),
        ];
        let schedule = vec![
            create_schedule_item("2"),
            create_schedule_item("4"),
            create_schedule_item("6"),
        ];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };
        assert!(train_schedule.contains_stops_in_order(2, 4));
    }

    #[test]
    fn test_stops_not_in_order() {
        let path = vec![
            create_path_item_uic("1", 1),
            create_path_item_uic("2", 2),
            create_path_item_uic("3", 3),
        ];
        let schedule = vec![create_schedule_item("1"), create_schedule_item("3")];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };
        assert!(!train_schedule.contains_stops_in_order(3, 1));
    }

    #[test]
    fn test_one_stop_missing() {
        let path = vec![create_path_item_uic("1", 1), create_path_item_uic("2", 2)];
        let schedule = vec![create_schedule_item("1"), create_schedule_item("2")];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };
        assert!(!train_schedule.contains_stops_in_order(1, 9));
        assert!(!train_schedule.contains_stops_in_order(9, 2));
    }

    #[test]
    fn test_path_with_non_uic_items() {
        let path = vec![
            create_path_item_uic("1", 1),
            create_path_item_track_offset("3"),
            create_path_item_uic("2", 2),
        ];
        let schedule = vec![create_schedule_item("1"), create_schedule_item("2")];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };
        assert!(train_schedule.contains_stops_in_order(1, 2));
    }

    #[test]
    fn test_path_with_intermediate_stop() {
        let path = vec![
            create_path_item_uic("1", 1),
            create_path_item_uic("2", 2),
            create_path_item_uic("3", 3),
        ];
        let schedule = vec![
            create_schedule_item("1"),
            create_schedule_item("2"),
            create_schedule_item("3"),
        ];
        let train_schedule = TrainSchedule {
            path,
            schedule,
            ..Default::default()
        };

        assert!(!train_schedule.contains_stops_in_order(1, 3));
    }
}
