pub mod pathfinding;
pub mod timetable;
pub mod train_schedule;

crate::routes! {
            train_schedule::routes(),
            timetable::routes(),
            pathfinding::routes(),
}

crate::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
    pathfinding::schemas(),
}
