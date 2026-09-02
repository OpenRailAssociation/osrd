use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::train_schedule_linking)]
#[model(gen(ops = c, batch_ops = crd, list))]
pub struct TrainScheduleLinking {
    pub id: i64,
    pub timetable_id: i64,
    pub source_train_schedule_id: i64,
    pub source_occurrence_index: Option<i64>,
    pub source_added_exception_id: Option<i64>,
    pub source_train_schedule_instance_index: Option<i64>,
    pub target_train_schedule_id: i64,
    pub target_occurrence_index: Option<i64>,
    pub target_added_exception_id: Option<i64>,
    pub target_train_schedule_instance_index: Option<i64>,
}
