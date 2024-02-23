pub mod timetable;
pub mod train_schedule;

crate::routes! {
            train_schedule::routes(),
            timetable::routes(),
}

crate::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
}
