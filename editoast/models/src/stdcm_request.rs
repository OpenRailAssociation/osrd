use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq, Eq)]
#[model(table = database::tables::stdcm_request)]
#[model(gen(ops = cd))]
pub struct StdcmRequest {
    pub id: i64,
    pub rmi_id: String,
    pub created_by: i64,
    pub trace_id: Option<String>,
}
