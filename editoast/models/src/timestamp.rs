use diesel::deserialize;
use diesel::deserialize::FromSql;
use diesel::deserialize::FromSqlRow;
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
    Debug,
    Clone,
    diesel::expression::AsExpression,
    Serialize,
    Deserialize,
    FromSqlRow,
    PartialEq,
    PartialOrd,
    ToSchema,
)]
#[diesel(sql_type = sql_types::Timestamptz)]
pub struct Timestamp(jiff::Timestamp);

impl Timestamp {
    pub fn now() -> Timestamp {
        Timestamp(jiff::Timestamp::now())
    }
}

impl ToSql<sql_types::Timestamptz, Pg> for Timestamp {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        let dt = self.0.to_diesel();
        ToSql::<sql_types::Timestamptz, Pg>::to_sql(&dt, &mut out.reborrow())
    }
}

impl FromSql<sql_types::Timestamptz, Pg> for Timestamp {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Timestamp> {
        jiff_diesel::Timestamp::from_sql(bytes).map(|timestamp| Timestamp(timestamp.to_jiff()))
    }
}
