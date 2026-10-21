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
    use database::DbConnection;
    use database::DbConnectionPool;
    use schemas::timetable_type::TimetableType as SchemasTimetableType;

    use super::TimetableInheritance;
    use super::TimetableRanges;
    use crate::Timetable;
    use crate::TrainScheduleSet;
    use crate::prelude::*;
    use crate::timetable_type::TimetableType;

    #[rstest::rstest]
    #[case::timetable_cannot_inherit_from_timetable(
        (SchemasTimetableType::Calendar, false),
        (SchemasTimetableType::Calendar, false),
        None)]
    #[case::outer_must_not_be_train_schedule_set(
        (SchemasTimetableType::Calendar, true),
        (SchemasTimetableType::Calendar, true),
        None)]
    #[case::inner_must_be_train_schedule_set(
        (SchemasTimetableType::Calendar, true),
        (SchemasTimetableType::Calendar, false),
        None)]
    #[case::different_type(
        (SchemasTimetableType::Calendar, false),
        (SchemasTimetableType::Hourly, true),
        None)]
    #[case::inner_calendar_must_not_have_range(
        (SchemasTimetableType::Calendar, false),
        (SchemasTimetableType::Calendar, true),
        Some(TimetableRanges(vec![])))]
    #[case::inner_hourly_must_not_have_range(
        (SchemasTimetableType::Hourly, false),
        (SchemasTimetableType::Hourly, true),
        Some(TimetableRanges(vec![])))]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn incorrect_timetable_inheritance(
        #[case] outer: (SchemasTimetableType, bool),
        #[case] inner: (SchemasTimetableType, bool),
        #[case] ranges: Option<TimetableRanges>,
    ) {
        let pool = DbConnectionPool::for_tests();
        let outer_timetable_id = create_timetable(&mut pool.get_ok(), outer).await;
        let inner_timetable_id = create_timetable(&mut pool.get_ok(), inner).await;

        let error = TimetableInheritance::changeset()
            .outer_timetable_id(outer_timetable_id)
            .inner_timetable_id(inner_timetable_id)
            .ranges(ranges)
            .create(&mut pool.get_ok())
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn incorrect_timetable_inheritance_update() {
        let pool = DbConnectionPool::for_tests();
        let outer_timetable_id =
            create_timetable(&mut pool.get_ok(), (SchemasTimetableType::Calendar, false)).await;
        let inner_timetable_id =
            create_timetable(&mut pool.get_ok(), (SchemasTimetableType::Calendar, true)).await;
        let other_timetable_id =
            create_timetable(&mut pool.get_ok(), (SchemasTimetableType::Calendar, false)).await;

        let inclusion = TimetableInheritance::changeset()
            .outer_timetable_id(outer_timetable_id)
            .inner_timetable_id(inner_timetable_id)
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to include train schedule set");

        // An inclusion must not be updated to include a timetable which is not a train schedule set
        let error = TimetableInheritance::changeset()
            .inner_timetable_id(other_timetable_id)
            .update(&mut pool.get_ok(), inclusion.id)
            .await
            .unwrap_err();
        assert!(error.to_string().contains("Invalid timetable_inheritance"));
    }

    async fn create_timetable(
        conn: &mut DbConnection,
        (timetable_type, is_train_schedule_set): (SchemasTimetableType, bool),
    ) -> i64 {
        let changeset = Timetable::changeset().timetable_type(TimetableType(timetable_type));
        if is_train_schedule_set {
            TrainScheduleSet::create_with_timetable(conn, changeset)
                .await
                .expect("Failed to create train schedule set")
                .timetable_id
        } else {
            changeset
                .create(conn)
                .await
                .expect("Failed to create timetable")
                .id
        }
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
