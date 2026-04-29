use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Hash, Clone, Model, ToSchema, Serialize, Deserialize, PartialEq, Eq)]
#[model(table = database::tables::authn_group)]
#[model(gen(ops = rd, list, batch_ops = r))]
pub struct Group {
    pub id: i64,
    pub name: String,
}
