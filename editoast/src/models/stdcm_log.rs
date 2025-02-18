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
    #[schema(value_type = StdcmResponse)]
    pub response: Response,
    pub created: DateTime<Utc>,
    pub user_id: Option<i64>,
}

impl StdcmLog {
    pub async fn log(
        mut conn: DbConnection,
        trace_id: Option<String>,
        request: Request,
        response: Response,
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
