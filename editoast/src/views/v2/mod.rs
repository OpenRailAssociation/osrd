pub mod path;
pub mod pathfinding;
pub mod scenario;
pub mod timetable;
pub mod train_schedule;

crate::routes! {
            train_schedule::routes(),
            timetable::routes(),
            path::routes(),
            pathfinding::routes(),
            scenario::routes(),
}

crate::schemas! {
    train_schedule::schemas(),
    timetable::schemas(),
    path::schemas(),
    pathfinding::schemas(),
    scenario::schemas(),
}
