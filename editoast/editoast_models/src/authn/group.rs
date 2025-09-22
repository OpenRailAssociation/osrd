use crate as editoast_models; // HACK: remove after all models are in this crate
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Model, ToSchema, Serialize, Deserialize, PartialEq, Eq)]
#[model(table = database::tables::authn_group)]
#[model(gen(ops = r, list, batch_ops = r))]
pub struct Group {
    pub id: i64,
    pub name: String,
}
