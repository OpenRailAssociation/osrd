use editoast_derive::ViewError;
use thiserror::Error;

pub mod assets;
pub mod documents;

#[derive(Debug, Error, ViewError)]
#[error("File '{file}' not found")]
#[view_error(status = NOT_FOUND, context)]
pub struct FileNotFoundError {
    file: String,
}
