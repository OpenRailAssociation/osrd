use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbConnectionError {
    #[error(transparent)]
    DeadpoolPool(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[cfg(test)]
    #[error(transparent)]
    DeadpoolBuildPool(#[from] diesel_async::pooled_connection::deadpool::BuildError),
    #[error(transparent)]
    #[allow(dead_code)]
    DieselError(#[from] diesel::result::Error),
    #[allow(dead_code)]
    #[error("Test connection not initialized")]
    TestConnection,
}
