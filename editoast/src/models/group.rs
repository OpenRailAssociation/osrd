use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::authn_group)]
#[model(gen(ops = r, list))]
pub struct Group {
    pub id: i64,
    pub name: String,
}
