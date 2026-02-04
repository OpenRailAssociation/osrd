use crate::tables::*;

// Add missing joinable macros since diesel can not generate them automatically
diesel::joinable!(train_schedule_round_trips -> train_schedule (left_id));
