use database::tables::sql_types;
use diesel::deserialize::FromSqlRow;
use diesel::expression::AsExpression;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use std::io::Write;
use std::ops::Deref;
use std::str::FromStr;

use diesel::deserialize::FromSql;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize::Output;
use diesel::serialize::ToSql;

#[derive(
    Debug, Clone, PartialEq, Default, Serialize, Deserialize, FromSqlRow, AsExpression, ToSchema,
)]
#[diesel(sql_type = sql_types::TimetableType)]
pub struct TimetableType(pub schemas::timetable_type::TimetableType);

impl FromSql<sql_types::TimetableType, Pg> for TimetableType {
    fn from_sql(value: PgValue) -> diesel::deserialize::Result<Self> {
        let s = std::str::from_utf8(value.as_bytes()).map_err(|_| "Invalid UTF-8 data")?;
        schemas::timetable_type::TimetableType::from_str(s)
            .map(TimetableType)
            .map_err(|_| "Unrecognized enum variant for TimetableType".into())
    }
}

impl ToSql<sql_types::TimetableType, Pg> for TimetableType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        let variant: &str = &self.0.to_string();
        out.write_all(variant.as_bytes())?;
        Ok(diesel::serialize::IsNull::No)
    }
}

impl Deref for TimetableType {
    type Target = schemas::timetable_type::TimetableType;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
