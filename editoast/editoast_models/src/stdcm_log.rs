use chrono::DateTime;
use chrono::Utc;
use database::DbConnection;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::prelude::*;

use crate as editoast_models; // HACK: remove after all models are in this crate

#[editoast_derive::openapi_schema]
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StdcmResponseOrError {
    #[schema(value_type = StdcmResponse)]
    Response(serde_json::Value),
    RequestError(serde_json::Value),
}

#[editoast_derive::openapi_schema]
#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema)]
#[model(table = database::tables::stdcm_logs)]
#[model(gen(ops = crd, list))]
pub struct StdcmLog {
    pub id: i64,
    #[model(identifier)]
    pub trace_id: Option<String>,
    #[model(json)]
    #[schema(value_type = StdcmRequest)]
    pub request: serde_json::Value,
    #[model(json)]
    pub response: StdcmResponseOrError,
    pub created: DateTime<Utc>,
    pub user_id: Option<i64>,
}

impl StdcmLog {
    pub async fn log(
        mut conn: DbConnection,
        trace_id: Option<String>,
        request: serde_json::Value,
        response: StdcmResponseOrError,
        user_id: Option<i64>,
    ) {
        let stdcm_log_changeset = StdcmLog::changeset()
            .trace_id(trace_id)
            .request(request)
            .response(response)
            .user_id(user_id);
        if let Err(e) = stdcm_log_changeset.create(&mut conn).await {
            tracing::error!("Failed during log operation: {e}");
        }
    }
}
