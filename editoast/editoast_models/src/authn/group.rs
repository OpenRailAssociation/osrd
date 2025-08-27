use editoast_derive::Model;

use crate as editoast_models; // HACK: remove after all models are in this crate

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::authn_group)]
#[model(gen(ops = r, list))]
pub struct Group {
    pub id: i64,
    pub name: String,
}
