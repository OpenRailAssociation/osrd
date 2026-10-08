//! A wrapper type for `jiff::civil::Date`, compatible with `diesel`.
//!
//! Diesel doesn't plan on supporting jiff natively until it reaches version 1.0
//! See: https://github.com/diesel-rs/diesel/discussions/4995
//!
//! `jiff-diesel` provides Diesel trait implementations, but `jiff_diesel::TimestampDate` lacks implementations for `serde` and `utoipa`.
//!
//! This wrapper implements all the necessary traits in one place.

use diesel::deserialize;
use diesel::deserialize::FromSql;
use diesel::deserialize::FromSqlRow;
use diesel::expression::AsExpression;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize;
use diesel::serialize::Output;
use diesel::serialize::ToSql;
use diesel::sql_types;
use jiff_diesel::ToDiesel as _;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(
    Clone,
    Copy,
    Debug,
    PartialEq,
    PartialOrd,
    ToSchema,
    Serialize,
    Deserialize,
    AsExpression,
    FromSqlRow,
)]
#[diesel(sql_type = sql_types::Date)]
pub struct CivilDate(jiff::civil::Date);
impl ToSql<sql_types::Date, Pg> for CivilDate {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        let dt = self.0.to_diesel();
        ToSql::<sql_types::Date, Pg>::to_sql(&dt, &mut out.reborrow())
    }
}
impl FromSql<sql_types::Date, Pg> for CivilDate {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<CivilDate> {
        jiff_diesel::Date::from_sql(bytes).map(|date| CivilDate(date.to_jiff()))
    }
}
