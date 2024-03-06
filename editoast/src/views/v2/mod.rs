pub mod path;
pub mod timetable;
pub mod train_schedule;

crate::routes! {
            train_schedule::routes(),
            timetable::routes(),
            path::routes(),
}

crate::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
    path::schemas(),
}
