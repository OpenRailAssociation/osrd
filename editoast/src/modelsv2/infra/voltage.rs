use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
pub struct Voltage {
    #[diesel(sql_type = Text)]
    pub voltage: String,
}
