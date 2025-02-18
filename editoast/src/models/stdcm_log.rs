use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::stdcm::Request;
use crate::core::stdcm::Response;
use crate::models::prelude::*;

editoast_common::schemas! {
    StdcmLog,
    StdcmResponseOrError,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
pub enum StdcmResponseOrError {
    #[schema(value_type = StdcmResponse)]
    Response(Response),
    RequestError(serde_json::Value),
}

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema)]
#[model(table = editoast_models::tables::stdcm_logs)]
#[model(gen(ops = crd, list))]
pub struct StdcmLog {
    pub id: i64,
    #[model(identifier)]
    pub trace_id: Option<String>,
    #[model(json)]
    #[schema(value_type = StdcmRequest)]
    pub request: Request,
    #[model(json)]
    pub response: StdcmResponseOrError,
    pub created: DateTime<Utc>,
    pub user_id: Option<i64>,
}

impl StdcmLog {
    pub async fn log(
        mut conn: DbConnection,
        trace_id: Option<String>,
        request: Request,
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
