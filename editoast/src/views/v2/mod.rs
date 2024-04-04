pub mod path;
pub mod scenario;
pub mod timetable;
pub mod train_schedule;

crate::routes! {
            train_schedule::routes(),
            timetable::routes(),
            path::routes(),
            scenario::routes(),
}

editoast_common::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
    path::schemas(),
    scenario::schemas(),
}
