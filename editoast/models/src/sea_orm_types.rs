use std::ops::Deref;
use std::ops::DerefMut;

use chrono::Duration;
use common::units;
use common::units::quantities;
use geos::Geom as _;
use sea_orm::ActiveValue;
use sea_orm::ColIdx;
use sea_orm::DbErr;
use sea_orm::DeriveValueType;
use sea_orm::IntoActiveValue;
use sea_orm::QueryResult;
use sea_orm::TryGetError;
use sea_orm::TryGetable;
use sea_orm::TryGetableFromJson;
use sea_orm::Value;
use sea_orm::sea_query::ArrayType;
use sea_orm::sea_query::ColumnType;
use sea_orm::sea_query::Nullable;
use sea_orm::sea_query::StringLen;
use sea_orm::sea_query::ValueType;
use sea_orm::sea_query::ValueTypeErr;
use serde::Deserialize;
use serde::Serialize;
use serde::de::DeserializeOwned;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(transparent)]
pub struct ForeignJson<T>(T);

impl<T> ForeignJson<T> {
    pub fn new(value: T) -> Self {
        Self(value)
    }

    pub fn into_inner(self) -> T {
        self.0
    }
}

impl<T> AsRef<T> for ForeignJson<T> {
    fn as_ref(&self) -> &T {
        &self.0
    }
}

impl<T> AsMut<T> for ForeignJson<T> {
    fn as_mut(&mut self) -> &mut T {
        &mut self.0
    }
}

impl<T: Default> Default for ForeignJson<T> {
    fn default() -> Self {
        Self(T::default())
    }
}

impl<T> Deref for ForeignJson<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> DerefMut for ForeignJson<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl<T> From<T> for ForeignJson<T> {
    fn from(value: T) -> Self {
        Self::new(value)
    }
}

impl<T> TryGetableFromJson for ForeignJson<T> where T: DeserializeOwned {}

impl<T> From<ForeignJson<T>> for Value
where
    T: Serialize,
{
    fn from(source: ForeignJson<T>) -> Self {
        Self::Json(Some(Box::new(
            serde_json::to_value(source).expect("ForeignJson must be serializable"),
        )))
    }
}

impl<T> ValueType for ForeignJson<T>
where
    T: DeserializeOwned + Serialize,
{
    fn try_from(value: Value) -> Result<Self, ValueTypeErr> {
        match value {
            Value::Json(Some(json)) => serde_json::from_value(*json).map_err(|_| ValueTypeErr),
            _ => Err(ValueTypeErr),
        }
    }

    fn type_name() -> String {
        format!("ForeignJson<{}>", std::any::type_name::<T>())
    }

    fn array_type() -> ArrayType {
        ArrayType::Json
    }

    fn column_type() -> ColumnType {
        ColumnType::Json
    }
}

impl<T> Nullable for ForeignJson<T>
where
    T: DeserializeOwned + Serialize,
{
    fn null() -> Value {
        Value::Json(None)
    }
}

impl<T> IntoActiveValue<ForeignJson<T>> for ForeignJson<T>
where
    T: DeserializeOwned + Serialize,
{
    fn into_active_value(self) -> ActiveValue<Self> {
        ActiveValue::set(self)
    }
}

impl<T> sea_orm::sea_query::postgres_array::NotU8 for ForeignJson<T> {}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct Meters(f64);

impl From<quantities::Length> for Meters {
    fn from(value: quantities::Length) -> Self {
        Self(units::meter::from(value))
    }
}

impl From<Meters> for quantities::Length {
    fn from(value: Meters) -> Self {
        units::meter::new(value.0)
    }
}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct MetersPerSecond(f64);

impl From<quantities::Velocity> for MetersPerSecond {
    fn from(value: quantities::Velocity) -> Self {
        Self(units::meter_per_second::from(value))
    }
}

impl From<MetersPerSecond> for quantities::Velocity {
    fn from(value: MetersPerSecond) -> Self {
        units::meter_per_second::new(value.0)
    }
}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct Seconds(f64);

impl From<quantities::Time> for Seconds {
    fn from(value: quantities::Time) -> Self {
        Self(units::second::from(value))
    }
}

impl From<Seconds> for quantities::Time {
    fn from(value: Seconds) -> Self {
        units::second::new(value.0)
    }
}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct MetersPerSecondSquared(f64);

impl From<quantities::Acceleration> for MetersPerSecondSquared {
    fn from(value: quantities::Acceleration) -> Self {
        Self(units::meter_per_second_squared::from(value))
    }
}

impl From<MetersPerSecondSquared> for quantities::Acceleration {
    fn from(value: MetersPerSecondSquared) -> Self {
        units::meter_per_second_squared::new(value.0)
    }
}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct Kilograms(f64);

impl From<quantities::Mass> for Kilograms {
    fn from(value: quantities::Mass) -> Self {
        Self(units::kilogram::from(value))
    }
}

impl From<Kilograms> for quantities::Mass {
    fn from(value: Kilograms) -> Self {
        units::kilogram::new(value.0)
    }
}

#[derive(Clone, Copy, Debug, DeriveValueType, Deserialize, PartialEq, Serialize, sqlx::Type)]
#[serde(transparent)]
#[sqlx(transparent)]
pub struct Milliseconds(i64);

impl From<quantities::Offset> for Milliseconds {
    fn from(value: quantities::Offset) -> Self {
        Self(units::millisecond::i64::from(value))
    }
}

impl From<Milliseconds> for quantities::Offset {
    fn from(value: Milliseconds) -> Self {
        units::millisecond::i64::new(value.0)
    }
}

impl From<i64> for Milliseconds {
    fn from(value: i64) -> Self {
        Self(value)
    }
}

impl From<Milliseconds> for i64 {
    fn from(value: Milliseconds) -> Self {
        value.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Interval(Duration);

impl Interval {
    const DAYS_PER_MONTH: i64 = 30;

    fn from_postgres(value: sqlx::postgres::types::PgInterval) -> Result<Self, DbErr> {
        let month_days = i64::from(value.months)
            .checked_mul(Self::DAYS_PER_MONTH)
            .ok_or_else(|| DbErr::Type("PostgreSQL interval months overflowed".into()))?;
        let days = month_days
            .checked_add(i64::from(value.days))
            .ok_or_else(|| DbErr::Type("PostgreSQL interval days overflowed".into()))?;
        let duration = Duration::try_days(days)
            .and_then(|duration| duration.checked_add(&Duration::microseconds(value.microseconds)))
            .ok_or_else(|| DbErr::Type("PostgreSQL interval is outside chrono::Duration".into()))?;
        Ok(Self(duration))
    }

    fn components(self) -> (i64, i64, i64) {
        let total_days = self.0.num_days();
        let months = total_days / Self::DAYS_PER_MONTH;
        let days = total_days % Self::DAYS_PER_MONTH;
        let day_duration = Duration::days(total_days);
        let microseconds = (self.0 - day_duration)
            .num_microseconds()
            .expect("sub-day interval remainder must fit in i64");
        (months, days, microseconds)
    }

    fn encoded(self) -> String {
        let (months, days, microseconds) = self.components();
        format!("{months} mons {days} days {microseconds} microseconds")
    }

    fn decode(value: &str) -> Result<Self, ValueTypeErr> {
        let mut parts = value.split_whitespace();
        let months = parts
            .next()
            .and_then(|value| value.parse::<i32>().ok())
            .ok_or(ValueTypeErr)?;
        if parts.next() != Some("mons") {
            return Err(ValueTypeErr);
        }
        let days = parts
            .next()
            .and_then(|value| value.parse::<i32>().ok())
            .ok_or(ValueTypeErr)?;
        if parts.next() != Some("days") {
            return Err(ValueTypeErr);
        }
        let microseconds = parts
            .next()
            .and_then(|value| value.parse::<i64>().ok())
            .ok_or(ValueTypeErr)?;
        if parts.next() != Some("microseconds") || parts.next().is_some() {
            return Err(ValueTypeErr);
        }
        Self::from_postgres(sqlx::postgres::types::PgInterval {
            months,
            days,
            microseconds,
        })
        .map_err(|_| ValueTypeErr)
    }
}

impl From<Duration> for Interval {
    fn from(value: Duration) -> Self {
        Self(value)
    }
}

impl From<Interval> for Duration {
    fn from(value: Interval) -> Self {
        value.0
    }
}

impl From<Interval> for Value {
    fn from(value: Interval) -> Self {
        Self::String(Some(value.encoded()))
    }
}

impl TryGetable for Interval {
    fn try_get_by<I: ColIdx>(result: &QueryResult, index: I) -> Result<Self, TryGetError> {
        let value = result
            .try_get_from_sqlx_postgres::<sqlx::postgres::types::PgInterval, _>(index)
            .ok_or_else(|| DbErr::Type("Interval can only be decoded from PostgreSQL".into()))??;
        Self::from_postgres(value).map_err(Into::into)
    }
}

impl ValueType for Interval {
    fn try_from(value: Value) -> Result<Self, ValueTypeErr> {
        match value {
            Value::String(Some(value)) => Self::decode(value.as_ref()),
            _ => Err(ValueTypeErr),
        }
    }

    fn type_name() -> String {
        "Interval".into()
    }

    fn array_type() -> ArrayType {
        ArrayType::String
    }

    fn column_type() -> ColumnType {
        ColumnType::Interval(None, None)
    }
}

impl Nullable for Interval {
    fn null() -> Value {
        Value::String(None)
    }
}

impl IntoActiveValue<Interval> for Interval {
    fn into_active_value(self) -> ActiveValue<Self> {
        ActiveValue::set(self)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum GeometryError {
    #[error(transparent)]
    Geos(#[from] geos::Error),
    #[error("expected SRID 3857, got {0}")]
    InvalidSrid(i32),
}

#[derive(Clone)]
pub struct Geometry(geos::Geometry);

impl PartialEq for Geometry {
    fn eq(&self, other: &Self) -> bool {
        match (self.ewkb(), other.ewkb()) {
            (Ok(left), Ok(right)) => left == right,
            _ => false,
        }
    }
}

impl std::fmt::Debug for Geometry {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Geometry")
            .field("srid", &Self::SRID)
            .finish()
    }
}

impl Geometry {
    pub const SRID: i32 = 3857;

    pub fn new(value: geos::Geometry) -> Result<Self, GeometryError> {
        let srid = value.get_srid()?;
        if srid != Self::SRID {
            return Err(GeometryError::InvalidSrid(srid));
        }
        Ok(Self(value))
    }

    pub fn into_inner(self) -> geos::Geometry {
        self.0
    }

    fn ewkb(&self) -> Result<Vec<u8>, geos::Error> {
        let mut writer = geos::WKBWriter::new()?;
        writer.set_include_SRID(true);
        writer.write_wkb(&self.0)
    }
}

impl TryFrom<geos::Geometry> for Geometry {
    type Error = GeometryError;

    fn try_from(value: geos::Geometry) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl From<Geometry> for geos::Geometry {
    fn from(value: Geometry) -> Self {
        value.into_inner()
    }
}

impl From<Geometry> for Value {
    fn from(value: Geometry) -> Self {
        Self::Bytes(Some(
            value
                .ewkb()
                .expect("validated GEOS geometry must be writable as EWKB"),
        ))
    }
}

struct PgGeometry(Vec<u8>);

impl sqlx::Type<sqlx::Postgres> for PgGeometry {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("geometry")
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for PgGeometry {
    fn decode(value: sqlx::postgres::PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        Ok(Self(value.as_bytes()?.to_vec()))
    }
}

impl TryGetable for Geometry {
    fn try_get_by<I: ColIdx>(result: &QueryResult, index: I) -> Result<Self, TryGetError> {
        let bytes = result
            .try_get_from_sqlx_postgres::<PgGeometry, _>(index)
            .ok_or_else(|| DbErr::Type("Geometry can only be decoded from PostgreSQL".into()))??;
        let geometry = geos::Geometry::new_from_wkb(&bytes.0)
            .map_err(|error| DbErr::Type(format!("invalid geometry EWKB: {error}")))?;
        Self::new(geometry)
            .map_err(|error| DbErr::Type(format!("invalid database geometry: {error}")))
            .map_err(Into::into)
    }
}

impl ValueType for Geometry {
    fn try_from(value: Value) -> Result<Self, ValueTypeErr> {
        match value {
            Value::Bytes(Some(bytes)) => geos::Geometry::new_from_wkb(bytes.as_ref())
                .ok()
                .and_then(|geometry| Self::new(geometry).ok())
                .ok_or(ValueTypeErr),
            _ => Err(ValueTypeErr),
        }
    }

    fn type_name() -> String {
        "Geometry".into()
    }

    fn array_type() -> ArrayType {
        ArrayType::Bytes
    }

    fn column_type() -> ColumnType {
        ColumnType::VarBinary(StringLen::None)
    }
}

impl Nullable for Geometry {
    fn null() -> Value {
        Value::Bytes(None)
    }
}

impl IntoActiveValue<Geometry> for Geometry {
    fn into_active_value(self) -> ActiveValue<Self> {
        ActiveValue::set(self)
    }
}

#[cfg(test)]
mod tests;
