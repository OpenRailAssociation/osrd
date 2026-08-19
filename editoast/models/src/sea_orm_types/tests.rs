use chrono::Duration;
use common::units;
use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ConnectionTrait as _;
use sea_orm::DatabaseBackend;
use sea_orm::EntityTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::Set;
use sea_orm::Statement;
use sea_orm::Value;
use sea_orm::entity::prelude::*;
use sea_orm::prelude::Expr;
use serde::Deserialize;
use serde::Serialize;

use super::*;

#[derive(Clone, Copy, Debug, DeriveActiveEnum, EnumIter, Eq, PartialEq)]
#[sea_orm(rs_type = "i16", db_type = "SmallInteger")]
enum TestEnum {
    Zero = 0,
    One = 1,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize, utoipa::ToSchema)]
struct Payload {
    name: String,
    count: i64,
}

#[derive(Clone, Debug, DeriveEntityModel, PartialEq)]
#[sea_orm(table_name = "models_sea_orm_types_test")]
struct Model {
    #[sea_orm(primary_key)]
    id: i64,
    #[sea_orm(column_type = "JsonBinary")]
    payload: ForeignJson<Payload>,
    scalar: TestEnum,
    optional: Option<TestEnum>,
    values: Vec<TestEnum>,
    #[sea_orm(save_as = "interval")]
    duration: Option<Interval>,
    #[sea_orm(save_as = "geometry")]
    point: Option<Geometry>,
    #[sea_orm(save_as = "geometry")]
    line: Option<Geometry>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

async fn create_table(db: &Db) {
    db.execute_unprepared(
        r#"
        CREATE TABLE models_sea_orm_types_test (
            id BIGSERIAL PRIMARY KEY,
            payload JSONB NOT NULL,
            scalar SMALLINT NOT NULL,
            optional SMALLINT,
            values SMALLINT[] NOT NULL,
            duration INTERVAL,
            point geometry(Point, 3857),
            line geometry(LineString, 3857)
        )
        "#,
    )
    .await
    .unwrap();
}

fn active_model() -> ActiveModel {
    ActiveModel {
        payload: Set(ForeignJson::new(Payload {
            name: "payload".to_owned(),
            count: 42,
        })),
        scalar: Set(TestEnum::One),
        optional: Set(None),
        values: Set(Vec::new()),
        duration: Set(None),
        point: Set(None),
        line: Set(None),
        ..Default::default()
    }
}

fn geometry(wkt: &str) -> Geometry {
    let mut geometry = geos::Geometry::new_from_wkt(wkt).unwrap();
    geometry.set_srid(Geometry::SRID);
    Geometry::new(geometry).unwrap()
}

#[test]
fn foreign_json_and_units_keep_their_wire_shapes() {
    assert_eq!(
        serde_json::to_value(<ForeignJson<Payload> as utoipa::PartialSchema>::schema()).unwrap(),
        serde_json::json!({"$ref": "#/components/schemas/Payload"})
    );
    assert_eq!(
        serde_json::to_value(<Meters as utoipa::PartialSchema>::schema()).unwrap(),
        serde_json::to_value(<f64 as utoipa::PartialSchema>::schema()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(<Milliseconds as utoipa::PartialSchema>::schema()).unwrap(),
        serde_json::to_value(<i64 as utoipa::PartialSchema>::schema()).unwrap()
    );

    let payload = Payload {
        name: "example".to_owned(),
        count: 3,
    };
    let json = serde_json::to_value(ForeignJson::new(payload.clone())).unwrap();
    assert_eq!(json, serde_json::json!({"name": "example", "count": 3}));
    let decoded: ForeignJson<Payload> = serde_json::from_value(json).unwrap();
    assert_eq!(decoded.into_inner(), payload);

    let length = units::meter::new(12.5);
    let velocity = units::meter_per_second::new(13.5);
    let time = units::second::new(14.5);
    let acceleration = units::meter_per_second_squared::new(15.5);
    let mass = units::kilogram::new(16.5);
    let offset = units::millisecond::i64::new(17);

    let meters = Meters::from(length);
    let meters_per_second = MetersPerSecond::from(velocity);
    let seconds = Seconds::from(time);
    let meters_per_second_squared = MetersPerSecondSquared::from(acceleration);
    let kilograms = Kilograms::from(mass);
    let milliseconds = Milliseconds::from(offset);

    assert_eq!(
        serde_json::to_value(meters).unwrap(),
        serde_json::json!(12.5)
    );
    assert_eq!(
        serde_json::to_value(meters_per_second).unwrap(),
        serde_json::json!(13.5)
    );
    assert_eq!(
        serde_json::to_value(seconds).unwrap(),
        serde_json::json!(14.5)
    );
    assert_eq!(
        serde_json::to_value(meters_per_second_squared).unwrap(),
        serde_json::json!(15.5)
    );
    assert_eq!(
        serde_json::to_value(kilograms).unwrap(),
        serde_json::json!(16.5)
    );
    assert_eq!(
        serde_json::to_value(milliseconds).unwrap(),
        serde_json::json!(17)
    );

    assert_eq!(
        units::meter::from(Into::<quantities::Length>::into(meters)),
        12.5
    );
    assert_eq!(
        units::meter_per_second::from(Into::<quantities::Velocity>::into(meters_per_second)),
        13.5
    );
    assert_eq!(
        units::second::from(Into::<quantities::Time>::into(seconds)),
        14.5
    );
    assert_eq!(
        units::meter_per_second_squared::from(Into::<quantities::Acceleration>::into(
            meters_per_second_squared,
        )),
        15.5
    );
    assert_eq!(
        units::kilogram::from(Into::<quantities::Mass>::into(kilograms)),
        16.5
    );
    assert_eq!(
        units::millisecond::i64::from(Into::<quantities::Offset>::into(milliseconds)),
        17
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn foreign_json_and_enums_round_trip() {
    let db = Db::for_tests().await;
    create_table(&db).await;

    let empty = active_model().insert(&db).await.unwrap();
    assert_eq!(empty.scalar, TestEnum::One);
    assert_eq!(empty.optional, None);
    assert!(empty.values.is_empty());
    assert_eq!(empty.payload.name, "payload");

    let mut populated = active_model();
    populated.scalar = Set(TestEnum::Zero);
    populated.optional = Set(Some(TestEnum::One));
    populated.values = Set(vec![TestEnum::One, TestEnum::Zero]);
    let populated = populated.insert(&db).await.unwrap();
    assert_eq!(populated.scalar, TestEnum::Zero);
    assert_eq!(populated.optional, Some(TestEnum::One));
    assert_eq!(populated.values, vec![TestEnum::One, TestEnum::Zero]);

    let mut updated: ActiveModel = populated.into();
    updated.optional = Set(None);
    updated.values = Set(Vec::new());
    let updated = updated.update(&db).await.unwrap();
    assert_eq!(updated.optional, None);
    assert!(updated.values.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn intervals_round_trip_through_sea_orm_statements() {
    let db = Db::for_tests().await;
    create_table(&db).await;

    let null = active_model().insert(&db).await.unwrap();
    assert_eq!(null.duration, None);

    let cases = [
        Duration::zero(),
        Duration::hours(2) + Duration::microseconds(7),
        -Duration::minutes(15),
        Duration::days(30),
        Duration::days(62) - Duration::microseconds(3),
    ];
    for duration in cases {
        let mut active = active_model();
        active.duration = Set(Some(duration.into()));
        let inserted = active.insert(&db).await.unwrap();
        assert_eq!(
            inserted.duration.map(Into::<Duration>::into),
            Some(duration)
        );
    }

    let mixed = db
        .query_one_raw(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT INTERVAL '1 month 2 days -3 microseconds' AS duration",
        ))
        .await
        .unwrap()
        .unwrap()
        .try_get::<Interval>("", "duration")
        .unwrap();
    assert_eq!(
        Into::<Duration>::into(mixed),
        Duration::days(32) - Duration::microseconds(3)
    );

    let negative_month = db
        .query_one_raw(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT INTERVAL '-1 month' AS duration",
        ))
        .await
        .unwrap()
        .unwrap()
        .try_get::<Interval>("", "duration")
        .unwrap();
    assert_eq!(Into::<Duration>::into(negative_month), -Duration::days(30));

    let mut updated: ActiveModel = null.into();
    updated.duration = Set(Some(Interval::from(-Duration::seconds(1))));
    let updated = updated.update(&db).await.unwrap();
    assert_eq!(
        updated.duration.map(Into::<Duration>::into),
        Some(-Duration::seconds(1))
    );

    let filtered = Entity::find()
        .filter(Expr::cust_with_values(
            "duration = $1::interval",
            [Value::from(Interval::from(-Duration::seconds(1)))],
        ))
        .all(&db)
        .await
        .unwrap();
    assert_eq!(filtered, vec![updated]);

    assert!(
        <Interval as sea_orm::sea_query::ValueType>::try_from(Value::String(Some(
            "invalid".into()
        )))
        .is_err()
    );
    assert!(
        <Interval as sea_orm::sea_query::ValueType>::try_from(Value::String(Some(
            "2147483648 mons 0 days 0 microseconds".into()
        )))
        .is_err()
    );

    let mut out_of_range = active_model();
    out_of_range.duration = Set(Some(Interval::from(Duration::MAX)));
    assert!(out_of_range.insert(&db).await.is_err());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 1)]
async fn geometries_round_trip_as_ewkb_with_srid() {
    let db = Db::for_tests().await;
    create_table(&db).await;

    let mut active = active_model();
    active.point = Set(Some(geometry("POINT (1 2)")));
    active.line = Set(Some(geometry("LINESTRING (0 0, 3 4)")));
    let inserted = active.insert(&db).await.unwrap();

    let point = inserted.point.unwrap().into_inner();
    assert_eq!(point.get_srid().unwrap(), Geometry::SRID);
    assert_eq!(point.to_wkt().unwrap(), "POINT (1 2)");
    let line = inserted.line.unwrap().into_inner();
    assert_eq!(line.get_srid().unwrap(), Geometry::SRID);
    assert_eq!(line.to_wkt().unwrap(), "LINESTRING (0 0, 3 4)");

    let mut updated: ActiveModel = Entity::find_by_id(inserted.id)
        .one(&db)
        .await
        .unwrap()
        .unwrap()
        .into();
    updated.point = Set(None);
    updated.line = Set(Some(geometry("LINESTRING (1 1, 2 2)")));
    let updated = updated.update(&db).await.unwrap();
    assert!(updated.point.is_none());
    let line = updated.line.unwrap().into_inner();
    assert_eq!(line.get_srid().unwrap(), Geometry::SRID);
    assert_eq!(line.to_wkt().unwrap(), "LINESTRING (1 1, 2 2)");

    let invalid = geos::Geometry::new_from_wkt("POINT (0 0)").unwrap();
    assert!(matches!(
        Geometry::new(invalid),
        Err(GeometryError::InvalidSrid(0))
    ));
}
