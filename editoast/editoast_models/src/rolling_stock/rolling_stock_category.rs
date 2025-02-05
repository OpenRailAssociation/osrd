use std::io::Write;
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
#[diesel(sql_type = crate::tables::sql_types::RollingStockCategory)]
pub struct RollingStockCategory(pub editoast_schemas::rolling_stock::RollingStockCategory);

impl FromSql<crate::tables::sql_types::RollingStockCategory, Pg> for RollingStockCategory {
    fn from_sql(value: PgValue) -> diesel::deserialize::Result<Self> {
        let s = std::str::from_utf8(value.as_bytes()).map_err(|_| "Invalid UTF-8 data")?;
        editoast_schemas::rolling_stock::RollingStockCategory::from_str(s)
            .map(RollingStockCategory)
            .map_err(|_| "Unrecognized enum variant for RollingStockCategory".into())
    }
}

impl ToSql<crate::tables::sql_types::RollingStockCategory, Pg> for RollingStockCategory {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> diesel::serialize::Result {
        let variant: &str = &self.0.to_string();
        out.write_all(variant.as_bytes())?;
        Ok(diesel::serialize::IsNull::No)
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct RollingStockCategories(pub Vec<RollingStockCategory>);

impl From<Vec<Option<RollingStockCategory>>> for RollingStockCategories {
    fn from(categories: Vec<Option<RollingStockCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<RollingStockCategories> for Vec<Option<RollingStockCategory>> {
    fn from(categories: RollingStockCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}
