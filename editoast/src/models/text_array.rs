use diesel::backend::Backend;
use diesel::deserialize::FromSql;
use diesel::deserialize::Queryable;
use diesel::sql_types::Array;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;

/// This type is used to represent a postgresql array of text.
/// It is used to handle nullability of the array elements.
#[derive(Debug, Clone, Default)]
pub struct TextArray(Vec<Option<String>>);

impl From<TextArray> for Vec<String> {
    fn from(val: TextArray) -> Self {
        val.0.into_iter().flatten().collect()
    }
}

impl From<TextArray> for Option<Vec<String>> {
    fn from(val: TextArray) -> Self {
        Some(val.0.into_iter().flatten().collect())
    }
}

impl<DB> Queryable<Array<Nullable<Text>>, DB> for TextArray
where
    DB: Backend,
    Vec<Option<String>>: FromSql<Array<Nullable<Text>>, DB>,
{
    type Row = Vec<Option<String>>;

    fn build(s: Self::Row) -> diesel::deserialize::Result<Self> {
        Ok(TextArray(s))
    }
}

impl<DB> FromSql<Array<Nullable<Text>>, DB> for TextArray
where
    DB: Backend,
    Vec<Option<String>>: FromSql<Array<Nullable<Text>>, DB>,
{
    fn from_sql(bytes: DB::RawValue<'_>) -> diesel::deserialize::Result<Self> {
        Ok(TextArray(Vec::<Option<String>>::from_sql(bytes)?))
    }
}
