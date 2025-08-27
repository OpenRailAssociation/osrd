use std::collections::HashMap;
use std::ops::DerefMut;

use diesel::pg::Pg;
use schemas::primitives::Identifier;
use serde::Deserialize;

use super::Infra;
use crate::error::Result;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorTypeLabel;
use database::DbConnection;
use editoast_models::pagination::load_for_pagination;

#[derive(Default, Debug, Clone, PartialEq, Eq, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

impl Infra {
    pub async fn get_paginated_errors(
        &self,
        conn: &mut DbConnection,
        level: Level,
        error_type: Option<InfraErrorTypeLabel>,
        object_id: Option<Identifier>,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<InfraError>, u64)> {
        use database::tables::infra_layer_error::dsl;
        use database::tables::infra_layer_error::table;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::*;

        type Filter = Box<dyn BoxableExpression<table, Pg, SqlType = Bool>>;
        fn sql_true() -> Filter {
            Box::new(sql::<Bool>("TRUE"))
        }

        let level_filter: Filter = match level {
            Level::Warnings => Box::new(sql::<Text>("information->>'is_warning'").eq("true")),
            Level::Errors => Box::new(sql::<Text>("information->>'is_warning'").eq("false")),
            Level::All => sql_true(),
        };
        let error_type_filter: Filter = error_type
            .as_ref()
            .map(|ty| ty.as_ref())
            .map(|ty| -> Filter {
                Box::new(sql::<Text>("information->>'error_type'").eq(ty.to_owned()))
            })
            .unwrap_or_else(sql_true);
        let object_id_filter: Filter = object_id
            .map(|id| id.0)
            .map(|id| -> Filter { Box::new(sql::<Text>("information->>'obj_id'").eq(id)) })
            .unwrap_or_else(sql_true);

        let query = dsl::infra_layer_error
            .select(dsl::information)
            .filter(dsl::infra_id.eq(self.id))
            .filter(level_filter)
            .filter(error_type_filter)
            .filter(object_id_filter);

        #[derive(QueryableByName)]
        struct Result {
            #[diesel(sql_type = Jsonb)]
            information: diesel_json::Json<InfraError>,
        }
        let (results, count): (Vec<Result>, _) =
            load_for_pagination(conn, query, page, page_size).await?;
        let results = results.into_iter().map(|r| r.information.0).collect();
        Ok((results, count))
    }

    /// Get the number of errors for each error type and object type.
    pub async fn get_error_summary(
        &self,
        conn: &mut DbConnection,
    ) -> Result<HashMap<(String, String), u64>> {
        use database::tables::infra_layer_error::dsl;
        use diesel::dsl::count_star;
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::Text;
        use diesel_async::RunQueryDsl;

        let query = dsl::infra_layer_error
            .select((
                sql::<Text>("information->>'error_type'"),
                sql::<Text>("information->>'obj_type'"),
                count_star(),
            ))
            .filter(dsl::infra_id.eq(self.id))
            .filter(sql::<Text>("information->>'is_warning'").eq("false"))
            .group_by((
                sql::<Text>("information->>'error_type'"),
                sql::<Text>("information->>'obj_type'"),
            ))
            .order_by(count_star().desc());

        let results = query
            .load::<(String, String, i64)>(conn.write().await.deref_mut())
            .await?;

        Ok(results
            .into_iter()
            .map(|(err_ty, obj_ty, count)| ((err_ty, obj_ty), count as u64))
            .collect())
    }
}
