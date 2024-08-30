use diesel::pg::Pg;
use editoast_schemas::primitives::Identifier;
use serde::Deserialize;

use super::Infra;
use crate::error::Result;
use crate::generated_data::infra_error::{InfraError, InfraErrorTypeLabel};
use crate::modelsv2::pagination::load_for_pagination;
use editoast_models::DbConnection;

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
        use diesel::dsl::sql;
        use diesel::prelude::*;
        use diesel::sql_types::*;
        use editoast_models::tables::infra_layer_error::dsl;
        use editoast_models::tables::infra_layer_error::table;

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
}
