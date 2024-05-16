use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitTags {
    #[diesel(sql_type = Text)]
    pub tag: String,
}
