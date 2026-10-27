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
    /// The timetable containing another timetable
    pub outer_timetable_id: i64,
    /// The timetable included in another timetable
    pub inner_timetable_id: i64,
    pub ranges: Option<TimetableRanges>,
}

#[cfg(test)]
mod tests {
    use database::DbConnectionPool;

    use super::TimetableInheritance;
    use crate::Timetable;
    use crate::prelude::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_inheritance_rejects_cycles() {
        let pool = DbConnectionPool::for_tests();
        let mut timetables = Vec::new();
        for _ in 0..4 {
            timetables.push(
                Timetable::changeset()
                    .create(&mut pool.get_ok())
                    .await
                    .expect("Failed to create timetable"),
            );
        }
        let [a, b, c, d] = <[Timetable; 4]>::try_from(timetables).unwrap();

        // a -> b -> c
        TimetableInheritance::changeset()
            .outer_timetable_id(a.id)
            .inner_timetable_id(b.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap();
        TimetableInheritance::changeset()
            .outer_timetable_id(b.id)
            .inner_timetable_id(c.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap();

        let error = TimetableInheritance::changeset()
            .outer_timetable_id(b.id)
            .inner_timetable_id(a.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("would create a cycle"));
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(c.id)
            .inner_timetable_id(a.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("would create a cycle"));

        TimetableInheritance::changeset()
            .outer_timetable_id(a.id)
            .inner_timetable_id(c.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap();

        let c_includes_d = TimetableInheritance::changeset()
            .outer_timetable_id(c.id)
            .inner_timetable_id(d.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap();
        let error = TimetableInheritance::changeset()
            .inner_timetable_id(a.id)
            .update(&mut pool.get_ok(), c_includes_d.id)
            .await
            .unwrap_err();
        assert!(error.to_string().contains("would create a cycle"));
    }
}
