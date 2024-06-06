use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value as JsonValue;

use super::Infra;
use crate::error::Result;
use crate::modelsv2::DbConnection;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;

#[derive(Default, Debug, Clone, Deserialize)]
pub struct QueryParams {
    #[serde(default)]
    level: Level,
    pub error_type: Option<String>,
    object_id: Option<String>,
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfraError {
    #[diesel(sql_type = Json)]
    pub information: JsonValue,
}

impl Infra {
    pub async fn get_paginated_errors(
        &self,
        conn: &mut DbConnection,
        page: i64,
        per_page: i64,
        params: &QueryParams,
    ) -> Result<PaginatedResponse<InfraError>> {
        let mut query =
            String::from("SELECT information::text FROM infra_layer_error WHERE infra_id = $1");
        if params.level == Level::Warnings {
            query += " AND information->>'is_warning' = 'true'"
        } else if params.level == Level::Errors {
            query += " AND information->>'is_warning' = 'false'"
        }
        if params.error_type.is_some() {
            query += " AND information->>'error_type' = $2"
        }
        if params.object_id.is_some() {
            query += " AND information->>'obj_id' = $3"
        }
        let error_type = params.error_type.clone().unwrap_or_default();
        let object_id = params.object_id.clone().unwrap_or_default();
        sql_query(query)
            .bind::<BigInt, _>(self.id)
            .bind::<Text, _>(error_type)
            .bind::<Text, _>(object_id)
            .paginate(page, per_page)
            .load_and_count::<InfraError>(conn)
            .await
    }
}
