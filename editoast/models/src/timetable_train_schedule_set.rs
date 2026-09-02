use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
#[model(table = database::tables::timetable_train_schedule_set)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct TimetableTrainScheduleSet {
    pub id: i64,
    pub timetable_id: i64,
    pub train_schedule_set_id: i64,
}
