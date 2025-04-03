use std::collections::HashSet;

use chrono::DateTime;
use chrono::Utc;
use editoast_derive::EditoastError;
use editoast_derive::Model;
use editoast_models::DbConnection;
use editoast_models::model;
use editoast_models::rolling_stock::TrainCategory;
use editoast_schemas;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::Margins;
use editoast_schemas::train_schedule::PathItem;
use editoast_schemas::train_schedule::PowerRestrictionItem;
use editoast_schemas::train_schedule::ScheduleItem;
use editoast_schemas::train_schedule::TrainScheduleOptions;
use itertools::Itertools;

use crate::error::Result;
use crate::models::prelude::*;

use super::OperationalPointModel;

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

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "train_schedule:OperationalPointStopsError")]
pub enum OperationalPointStopsError {
    #[error(transparent)]
    Database(#[from] model::Error),
    #[error("Operational points not found: {ids:?}")]
    #[editoast_error(status = 500)]
    NotFound { ids: HashSet<String> },
}

impl TrainSchedule {
    pub fn stops(&self) -> impl Iterator<Item = &PathItem> {
        // complexity is about O(🤣)
        self.path
            .iter()
            .filter(|path_item| path_item.op_id().is_some_and(|id| self.stops_at(id)))
    }

    pub fn stops_at(&self, operational_point_id: &Identifier) -> bool {
        self.path
            .first()
            .is_some_and(|start| start.eq_op_id(operational_point_id))
            || self
                .path
                .last()
                .is_some_and(|end| end.eq_op_id(operational_point_id))
            || self
                .schedule
                .iter()
                .filter(|item| match &item.stop_for {
                    Some(duration) => !duration.is_zero(),
                    None => false,
                })
                .filter_map(|ScheduleItem { at, .. }| self.path.iter().find(|item| &item.id == at))
                .any(|item| item.eq_op_id(operational_point_id))
    }

    pub async fn operational_point_stops(
        &self,
        conn: &mut DbConnection,
        infra_id: i64,
    ) -> Result<Vec<OperationalPointModel>, OperationalPointStopsError> {
        let ids = self
            .stops()
            .filter_map(|item| item.op_id().map(|id| (infra_id, id.0.clone())))
            .collect_vec();
        let ops = OperationalPointModel::retrieve_batch_or_fail(conn, ids, |missing| {
            OperationalPointStopsError::NotFound {
                ids: missing.into_iter().map(|id| id.1).collect(),
            }
        })
        .await?;
        Ok(ops)
    }
}
