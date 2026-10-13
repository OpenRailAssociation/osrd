use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::scenario_timetable)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct ScenarioTimetable {
    pub id: i64,
    pub scenario_id: i64,
    pub timetable_id: i64,
}
