use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::authn_user)]
#[model(gen(list))]
pub struct User {
    pub id: i64,
    pub identity_id: String,
    pub name: String,
}
