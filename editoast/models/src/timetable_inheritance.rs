use diesel::deserialize::FromSql;
use diesel::deserialize::FromSqlRow;
use diesel::expression::AsExpression;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize::Output;
use diesel::serialize::ToSql;
use diesel::sql_types::Jsonb;
use editoast_derive::Model;
use schemas::primitives::StrictlyPositiveDuration;
use serde::Deserialize;
use serde::Serialize;
use unit_system::quantities::Offset;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct TimetableRange {
    #[serde(with = "unit_system::units::millisecond::i64")]
    #[schema(value_type = i64)]
    pub start_time: Offset,
    pub time_window: StrictlyPositiveDuration,
}

#[derive(Debug, Clone, PartialEq, FromSqlRow, AsExpression)]
#[diesel(sql_type = Jsonb)]
pub struct TimetableRanges(pub Vec<TimetableRange>);

impl FromSql<Jsonb, Pg> for TimetableRanges {
    fn from_sql(value: PgValue) -> diesel::deserialize::Result<Self> {
        let value = <serde_json::Value as FromSql<Jsonb, Pg>>::from_sql(value)?;
        Ok(Self(serde_json::from_value(value)?))
    }
}

impl ToSql<Jsonb, Pg> for TimetableRanges {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        let value = serde_json::to_value(&self.0)?;
        <serde_json::Value as ToSql<Jsonb, Pg>>::to_sql(&value, &mut out.reborrow())
    }
}

/// Inclusion of the timetable of a train schedule set (inner) in another timetable (outer)
#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(Default, PartialEq))]
#[model(table = database::tables::timetable_inheritance)]
#[model(gen(ops = crud, batch_ops = crud, list))]
pub struct TimetableInheritance {
    pub id: i64,
    pub outer_timetable_id: i64,
    pub inner_timetable_id: i64,
    pub ranges: Option<TimetableRanges>,
}
