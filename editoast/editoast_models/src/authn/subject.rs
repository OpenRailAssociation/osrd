use editoast_derive::Model;

use crate as editoast_models; // HACK: remove after all models are in this crate

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::authn_subject)]
#[model(gen(list))]
pub struct Subject {
    pub id: i64,
}
