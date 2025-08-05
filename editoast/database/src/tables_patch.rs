use crate::tables::*;

// Add missing joinable macros since diesel can not generate them automatically
diesel::joinable!(train_schedule_round_trips -> train_schedule (left_id));
diesel::joinable!(paced_train_round_trips -> paced_train (left_id));
