use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::search_journey_environment_timetable)]
#[model(gen(ops = c))]
pub struct SearchJourneyEnvironmentTimetable {
    pub id: i64,
    pub search_journey_environment_id: i64,
    pub timetable_id: i64,
}
