use std::ops::DerefMut;

use chrono::DateTime;
use chrono::Utc;
use diesel::sql_query;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel::sql_types::Timestamptz;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use editoast_models::DatabaseError;
use editoast_models::DbConnection;
use editoast_models::rolling_stock::TrainCategory;
use editoast_schemas;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleOptions;

use crate::models::prelude::*;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default))]
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
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
    ) -> Result<Vec<TrainSchedule>, DatabaseError> {
        let result = sql_query(
            "SELECT * FROM train_schedule
            WHERE rolling_stock_name = $1
            AND ($2 IS NULL OR speed_limit_tag = $2)
            AND timetable_id IN (
                SELECT timetable_id
                FROM stdcm_search_environment
                WHERE search_window_begin >= $3
                AND search_window_end <= $4
            )",
        )
        .bind::<Text, _>(rolling_stock_name)
        .bind::<Nullable<Text>, _>(speed_limit_tag)
        .bind::<Timestamptz, _>(start_time)
        .bind::<Timestamptz, _>(end_time)
        .get_results::<TrainScheduleRow>(conn.write().await.deref_mut())
        .await;

        match result {
            Ok(result) => Ok(result.into_iter().map(Into::into).collect()),
            Err(err) => Err(err.into()),
        }
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
