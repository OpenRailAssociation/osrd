use std::io::Write;
use std::ops::Deref;
use std::str::FromStr;

use diesel::deserialize::FromSql;
use diesel::deserialize::FromSqlRow;
use diesel::expression::AsExpression;
use diesel::pg::Pg;
use diesel::pg::PgValue;
use diesel::serialize::Output;
use diesel::serialize::ToSql;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, FromSqlRow, AsExpression)]
#[diesel(sql_type = crate::tables::sql_types::TrainCategory)]
pub struct TrainCategory(pub editoast_schemas::rolling_stock::TrainCategory);

impl FromSql<crate::tables::sql_types::TrainCategory, Pg> for TrainCategory {
    fn from_sql(value: PgValue) -> diesel::deserialize::Result<Self> {
        let s = std::str::from_utf8(value.as_bytes()).map_err(|_| "Invalid UTF-8 data")?;
        editoast_schemas::rolling_stock::TrainCategory::from_str(s)
            .map(TrainCategory)
            .map_err(|_| "Unrecognized enum variant for TrainCategory".into())
    }
}

impl ToSql<crate::tables::sql_types::TrainCategory, Pg> for TrainCategory {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        let variant: &str = &self.0.to_string();
        out.write_all(variant.as_bytes())?;
        Ok(diesel::serialize::IsNull::No)
    }
}

impl Deref for TrainCategory {
    type Target = editoast_schemas::rolling_stock::TrainCategory;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct TrainCategories(pub Vec<TrainCategory>);

impl From<Vec<Option<TrainCategory>>> for TrainCategories {
    fn from(categories: Vec<Option<TrainCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<TrainCategories> for Vec<Option<TrainCategory>> {
    fn from(categories: TrainCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}

impl Deref for TrainCategories {
    type Target = Vec<TrainCategory>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
