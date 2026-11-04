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
    use super::TimetableRanges;
    use crate::Timetable;
    use crate::TrainScheduleSet;
    use crate::prelude::*;
    use crate::timetable_type::TimetableType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_inheritance_rejects_unsupported_types() {
        let pool = DbConnectionPool::for_tests();
        let timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");
        let other_timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");
        let train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");
        let other_train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");
        let hourly_train_schedule_set = TrainScheduleSet::create_with_timetable(
            &mut pool.get_ok(),
            Timetable::changeset().timetable_type(TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            )),
        )
        .await
        .expect("Failed to create train schedule set");

        let inclusion = TimetableInheritance::changeset()
            .outer_timetable_id(timetable.id)
            .inner_timetable_id(train_schedule_set.timetable_id)
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to include train schedule set");

        // A timetable which is not a train schedule set must not be included
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(timetable.id)
            .inner_timetable_id(other_timetable.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));

        // A train schedule set must not include another train schedule set
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(train_schedule_set.timetable_id)
            .inner_timetable_id(other_train_schedule_set.timetable_id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));

        // A train schedule set must not include a timetable
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(train_schedule_set.timetable_id)
            .inner_timetable_id(timetable.id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));

        // A train schedule set of another type must not be included
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(timetable.id)
            .inner_timetable_id(hourly_train_schedule_set.timetable_id)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));

        // A train schedule set must not be included with ranges
        let error = TimetableInheritance::changeset()
            .outer_timetable_id(other_timetable.id)
            .inner_timetable_id(train_schedule_set.timetable_id)
            .ranges(Some(TimetableRanges(vec![])))
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));

        // An inclusion must not be updated to include a timetable which is not a train schedule set
        let error = TimetableInheritance::changeset()
            .inner_timetable_id(other_timetable.id)
            .update(&mut pool.get_ok(), inclusion.id)
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_set_cannot_include_a_timetable() {
        let pool = DbConnectionPool::for_tests();
        let timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");
        let train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");
        let other_train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");

        // Including a train schedule set of the same type is otherwise allowed
        for inner_timetable_id in [other_train_schedule_set.timetable_id, timetable.id] {
            let error = TimetableInheritance::changeset()
                .outer_timetable_id(train_schedule_set.timetable_id)
                .inner_timetable_id(inner_timetable_id)
                .create(&mut pool.get_ok())
                .await
                .unwrap_err();
            assert!(error.to_string().contains("cannot include a timetable"));
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_type_is_immutable() {
        let pool = DbConnectionPool::for_tests();
        let timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");

        let result = Timetable::changeset()
            .timetable_type(TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            ))
            .update(&mut pool.get_ok(), timetable.id)
            .await;
        assert!(result.is_err());
    }
}
