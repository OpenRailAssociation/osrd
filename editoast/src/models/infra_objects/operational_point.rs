//! Provides the [OperationalPointModel] model

use crate::error::Result;
use crate::{schema::OperationalPoint, tables::infra_object_operational_point};
use derivative::Derivative;
use diesel::sql_types::{Array, BigInt, Text};
use diesel::{result::Error as DieselError, sql_query};
use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, Queryable, QueryableByName, Model)]
#[derivative(Default(new = "true"))]
#[model(table = "infra_object_operational_point")]
#[model(retrieve, delete)]
#[diesel(table_name = infra_object_operational_point)]
pub struct OperationalPointModel {
    pub id: i64,
    pub obj_id: String,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub data: diesel_json::Json<OperationalPoint>,
    pub infra_id: i64,
}

impl OperationalPointModel {
    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_uic(
        conn: &mut PgConnection,
        infra_id: i64,
        uic: &[i64],
    ) -> Result<Vec<Self>> {
        let query = "SELECT * FROM infra_object_operational_point
                                WHERE infra_id = $1 AND (data->'extensions'->'identifier'->'uic')::integer = ANY($2)".to_string();
        Ok(sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<BigInt>, _>(uic)
            .load(conn)
            .await?)
    }

    /// Retrieve a list of operational points from the database
    pub async fn retrieve_from_obj_ids(
        conn: &mut PgConnection,
        infra_id: i64,
        ids: &[String],
    ) -> Result<Vec<Self>> {
        let query = "SELECT * FROM infra_object_operational_point
                                WHERE infra_id = $1 AND infra_object_operational_point.obj_id = ANY($2)".to_string();
        Ok(sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<Text>, _>(ids)
            .load(conn)
            .await?)
    }
}
