use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::authn_subject)]
#[model(gen(list))]
pub struct Subject {
    pub id: i64,
}
