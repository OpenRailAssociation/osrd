use std::io::Write;
use std::ops::Deref;
use std::str::FromStr;

use database::tables::sql_types;
use diesel::deserialize::FromSql;
use diesel::deserialize::FromSqlRow;
use diesel::expression::AsExpression;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize::Output;
use diesel::serialize::ToSql;
use serde::Deserialize;
use serde::Serialize;

#[derive(
    Debug, Clone, PartialEq, Serialize, Deserialize, FromSqlRow, AsExpression, utoipa::ToSchema,
)]
#[diesel(sql_type = sql_types::TrainMainCategory)]
pub struct TrainMainCategory(pub schemas::rolling_stock::TrainMainCategory);

impl FromSql<sql_types::TrainMainCategory, Pg> for TrainMainCategory {
    fn from_sql(value: PgValue) -> diesel::deserialize::Result<Self> {
        let s = std::str::from_utf8(value.as_bytes()).map_err(|_| "Invalid UTF-8 data")?;
        schemas::rolling_stock::TrainMainCategory::from_str(s)
            .map(TrainMainCategory)
            .map_err(|_| "Unrecognized enum variant for TrainCategory".into())
    }
}

impl ToSql<sql_types::TrainMainCategory, Pg> for TrainMainCategory {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        let variant: &str = &self.0.to_string();
        out.write_all(variant.as_bytes())?;
        Ok(diesel::serialize::IsNull::No)
    }
}

impl Deref for TrainMainCategory {
    type Target = schemas::rolling_stock::TrainMainCategory;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, utoipa::ToSchema)]
pub struct TrainMainCategories(pub Vec<TrainMainCategory>);

impl From<Vec<Option<TrainMainCategory>>> for TrainMainCategories {
    fn from(categories: Vec<Option<TrainMainCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<TrainMainCategories> for Vec<Option<TrainMainCategory>> {
    fn from(categories: TrainMainCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}

impl Deref for TrainMainCategories {
    type Target = Vec<TrainMainCategory>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
