use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::authn_user)]
#[model(gen(ops = r, list))]
pub struct User {
    pub id: i64,
    pub identity_id: String,
    pub name: String,
}
