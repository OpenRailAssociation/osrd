use diesel::{ConnectionError, ConnectionResult};
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;
use diesel_async::pooled_connection::ManagerConfig;
use diesel_async::AsyncPgConnection;
use futures_util::future::BoxFuture;
use futures_util::FutureExt;
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use tracing::error;
use url::Url;

pub type ConnectionConfig = AsyncDieselConnectionManager<AsyncPgConnection>;
pub type ConnectionPool = Pool<Connection>;
pub type Connection = AsyncPgConnection;

pub fn create_connection_pool(url: Url, max_size: usize) -> ConnectionPool {
    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(establish_connection);
    let manager = ConnectionConfig::new_with_config(url, manager_config);
    Pool::builder(manager)
        .max_size(max_size)
        .build()
        .expect("Failed to create pool.")
}

fn establish_connection(config: &str) -> BoxFuture<ConnectionResult<Connection>> {
    let fut = async {
        let mut connector_builder = SslConnector::builder(SslMethod::tls()).unwrap();
        connector_builder.set_verify(SslVerifyMode::NONE);
        let tls = postgres_openssl::MakeTlsConnector::new(connector_builder.build());
        let (client, conn) = tokio_postgres::connect(config, tls)
            .await
            .map_err(|e| ConnectionError::BadConnection(e.to_string()))?;
        // The connection object performs the actual communication with the database,
        // so spawn it off to run on its own.
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                error!("connection error: {}", e);
            }
        });
        Connection::try_from(client).await
    };
    fut.boxed()
}
