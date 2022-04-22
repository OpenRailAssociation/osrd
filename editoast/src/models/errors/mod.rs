mod signals;
mod speed_sections;

use diesel::result::Error as DieselError;
use diesel::{sql_query, sql_types::Integer, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::client::ChartosConfig;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};

use super::invalidate_chartos_layer;

/// This
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct InfraError {
    field: String,
    is_warning: bool,
    #[serde(flatten)]
    sub_type: InfraErrorType,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "error_type", deny_unknown_fields)]
enum InfraErrorType {
    #[serde(rename = "invalid_reference")]
    InvalidReference { reference: ObjectRef },
    #[serde(rename = "out_of_range")]
    OutOfRange {
        position: f64,
        expected_range: [f64; 2],
    },
}

impl InfraError {
    fn new_invalid_reference(field: String, reference: ObjectRef) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::InvalidReference { reference },
        }
    }

    fn new_out_of_range(field: String, position: f64, expected_range: [f64; 2]) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::OutOfRange {
                position,
                expected_range,
            },
        }
    }
}

/// This function regenerate the errors and warnings of the infra
pub fn generate_errors(
    conn: &PgConnection,
    infra: i32,
    infra_cache: &InfraCache,
    chartos_config: &ChartosConfig,
) -> Result<(), DieselError> {
    // Clear the whole layer
    sql_query("DELETE FROM osrd_infra_errorlayer WHERE infra_id = $1")
        .bind::<Integer, _>(infra)
        .execute(conn)?;

    // Generate the errors
    signals::generate_errors(conn, infra, infra_cache)?;
    speed_sections::generate_errors(conn, infra, infra_cache)?;

    // Invalidate chartos cache
    invalidate_chartos_layer(infra, "errors", chartos_config);
    Ok(())
}
