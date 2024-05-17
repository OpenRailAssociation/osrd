use diesel::sql_types::Text;

#[derive(QueryableByName, Default)]
pub struct RailJsonData {
    #[diesel(sql_type = Text)]
    pub railjson: String,
}
