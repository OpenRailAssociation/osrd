use thiserror::Error;

#[derive(Debug, Error)]
pub enum GeometryError {
    #[error("expected geometry {expected} but got {actual}")]
    UnexpectedGeometry { expected: String, actual: String },
}
