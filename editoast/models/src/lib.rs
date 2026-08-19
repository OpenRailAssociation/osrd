pub mod authn;
pub mod catalog_entry;
pub mod document;
pub mod electrical_profiles;
pub mod infra;
pub mod infra_objects;
pub mod macro_node;
pub mod macro_note;
pub mod map;
pub mod project;
pub mod railjson;
pub mod rolling_stock;
pub mod rolling_stock_image;
pub mod rolling_stock_livery;
pub mod round_trips;
pub mod scenario;
pub mod sea_orm_types;
pub mod search_journey_environment;
pub mod search_journey_environment_timetable;
pub mod stdcm_search_environment;
pub mod study;
pub mod sub_category;
pub mod tags;
pub mod temporary_speed_limits;
pub mod timetable;
pub mod timetable_train_schedule_set;
pub mod timetable_type;
pub mod towed_rolling_stock;
pub mod train_schedule;
pub mod train_schedule_exception;
pub mod train_schedule_linking;
pub mod train_schedule_set;
pub mod work_schedules;

use std::ops::Deref as _;
use std::sync::Arc;

use regex::regex;
use sea_orm::DbErr;
use sea_orm::RuntimeErr;
use sqlx::postgres::PgDatabaseError;

#[derive(Debug, thiserror::Error, PartialEq)]
#[error(transparent)]
pub struct Error(#[from] DbErr);

pub struct UniqueViolation {
    pub constraint: String,
    pub column: String,
    pub value: String,
}

impl From<sqlx::Error> for Error {
    fn from(error: sqlx::Error) -> Self {
        Self(DbErr::Query(RuntimeErr::SqlxError(Arc::new(error))))
    }
}

impl Error {
    pub fn unique_violation(&self) -> Option<UniqueViolation> {
        let error: &PgDatabaseError = match &self.0 {
            DbErr::Exec(RuntimeErr::SqlxError(error))
            | DbErr::Query(RuntimeErr::SqlxError(error))
                if let sqlx::Error::Database(error) = error.deref() =>
            {
                error.try_downcast_ref()?
            }
            _ => return None,
        };
        if error.code() != "23505" {
            return None;
        }
        let captures =
            regex!(r#"Key \(([^)]+)\)=\(([^)]+)\) already exists\."#).captures(error.detail()?)?;
        Some(UniqueViolation {
            constraint: error.constraint().unwrap_or_default().to_owned(),
            column: captures.get(1).unwrap().as_str().to_owned(),
            value: captures.get(2).unwrap().as_str().to_owned(),
        })
    }

    pub fn is_check_violation(&self, constraint: &str) -> bool {
        let error: &PgDatabaseError = match &self.0 {
            DbErr::Exec(RuntimeErr::SqlxError(error))
            | DbErr::Query(RuntimeErr::SqlxError(error))
                if let sqlx::Error::Database(error) = error.deref() =>
            {
                let Some(error) = error.try_downcast_ref() else {
                    return false;
                };
                error
            }
            _ => return false,
        };
        error.code() == "23514" && error.constraint() == Some(constraint)
    }

    pub fn is_foreign_key_violation(&self, constraint: &str) -> bool {
        let error: &PgDatabaseError = match &self.0 {
            DbErr::Exec(RuntimeErr::SqlxError(error))
            | DbErr::Query(RuntimeErr::SqlxError(error))
                if let sqlx::Error::Database(error) = error.deref() =>
            {
                let Some(error) = error.try_downcast_ref() else {
                    return false;
                };
                error
            }
            _ => return false,
        };
        error.code() == "23503" && error.constraint() == Some(constraint)
    }
}

impl From<sea_orm::TransactionError<Error>> for Error {
    fn from(error: sea_orm::TransactionError<Error>) -> Self {
        match error {
            sea_orm::TransactionError::Connection(error) => error.into(),
            sea_orm::TransactionError::Transaction(error) => error,
        }
    }
}
