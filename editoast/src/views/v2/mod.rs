pub mod path;
pub mod scenario;
pub mod timetable;
pub mod train_schedule;

crate::routes! {
    &train_schedule,
    &timetable,
    &path,
    &scenario,
}

editoast_common::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
    path::schemas(),
    scenario::schemas(),
}
