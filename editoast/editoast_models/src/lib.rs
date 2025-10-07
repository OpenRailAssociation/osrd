pub mod authn;
pub mod document;
pub mod electrical_profiles;
pub mod map;
pub mod pagination;
pub mod prelude;
pub mod rolling_stock;
pub mod rolling_stock_image;
pub mod sub_category;
pub mod tags;
pub mod temporary_speed_limits;
pub mod towed_rolling_stock;
pub mod work_schedules;

// Export all Model at crate root
pub use authn::group::Group;
pub use authn::subject::Subject;
pub use authn::user::User;
pub use document::Document;
pub use electrical_profiles::ElectricalProfileSet;
pub use electrical_profiles::LightElectricalProfileSet;
pub use rolling_stock_image::RollingStockImage;
pub use sub_category::SubCategory;
pub use tags::Tags;
pub use temporary_speed_limits::TemporarySpeedLimit;
pub use temporary_speed_limits::TemporarySpeedLimitGroup;
pub use towed_rolling_stock::TowedRollingStock;
pub use work_schedules::WorkSchedule;
pub use work_schedules::WorkScheduleGroup;

use std::sync::LazyLock;

use database::DatabaseError;

use diesel::result::DatabaseErrorInformation;
use diesel::result::DatabaseErrorKind;
use regex::Regex;

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum Error {
    #[error(
        "unique constraint violation \"{constraint}\" on column \"{column}\" with value \"{value}\""
    )]
    UniqueViolation {
        constraint: String,
        column: String,
        value: String,
    },
    #[error("check constraint violation of \"{constraint}\"")]
    CheckViolation { constraint: String },
    #[error("foreign key constraint violation of \"{constraint}\"")]
    ForeignKeyViolation { constraint: String },
    #[error(transparent)]
    DatabaseError(#[from] DatabaseError),
}

fn try_parse_unique_violation(e: &(dyn DatabaseErrorInformation + Send + Sync)) -> Option<Error> {
    static RE: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"duplicate key value violates unique constraint"#).unwrap());
    if RE.is_match(e.message()) {
        static RE: LazyLock<Regex> = LazyLock::new(|| {
            Regex::new(r#"Key \(([^)]+)\)=\(([^)]+)\) already exists\."#).unwrap()
        });
        RE.captures(e.details().expect("PostgreSQL should provide details"))
            .map(|captures| Error::UniqueViolation {
                constraint: e
                    .constraint_name()
                    .expect("PostgreSQL should provide the constraint name")
                    .to_owned(),
                column: captures.get(1).unwrap().as_str().to_owned(),
                value: captures.get(2).unwrap().as_str().to_owned(),
            })
    } else {
        None
    }
}

fn try_parse_check_violation(e: &(dyn DatabaseErrorInformation + Send + Sync)) -> Option<Error> {
    static RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"new row for relation .* violates check constraint"#).unwrap()
    });
    if RE.is_match(e.message()) {
        Some(Error::CheckViolation {
            constraint: e
                .constraint_name()
                .expect("PostgreSQL should provide the constraint name")
                .to_owned(),
        })
    } else {
        None
    }
}

fn try_parse_foreign_key_violation(
    e: &(dyn DatabaseErrorInformation + Send + Sync),
) -> Option<Error> {
    static RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"update or delete on table .* violates foreign key constraint"#).unwrap()
    });
    if RE.is_match(e.message()) {
        Some(Error::ForeignKeyViolation {
            constraint: e
                .constraint_name()
                .expect("PostgreSQL should provide the constraint name")
                .to_owned(),
        })
    } else {
        None
    }
}

impl From<diesel::result::Error> for Error {
    fn from(e: diesel::result::Error) -> Self {
        match &e {
            diesel::result::Error::DatabaseError(DatabaseErrorKind::UniqueViolation, inner) => {
                try_parse_unique_violation(inner.as_ref()).unwrap_or_else(move || {
                    // falling back to the generic error — since it's still semantically correct, logging the error is enough
                    tracing::error!(
                        error = %e,
                        "failed to parse PostgreSQL details message"
                    );
                    Self::DatabaseError(e.into())
                })
            }
            diesel::result::Error::DatabaseError(DatabaseErrorKind::CheckViolation, inner) => {
                try_parse_check_violation(inner.as_ref()).unwrap_or_else(|| {
                    // falling back to the generic error — since it's still semantically correct, logging the error is enough
                    tracing::error!(
                        error = %e,
                        "failed to parse PostgreSQL details message"
                    );
                    Self::DatabaseError(e.into())
                })
            }
            diesel::result::Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, inner) => {
                try_parse_foreign_key_violation(inner.as_ref()).unwrap_or_else(|| {
                    // falling back to the generic error — since it's still semantically correct, logging the error is enough
                    tracing::error!(
                        error = %e,
                        "failed to parse PostgreSQL details message"
                    );
                    Self::DatabaseError(e.into())
                })
            }
            _ => Self::DatabaseError(e.into()),
        }
    }
}
