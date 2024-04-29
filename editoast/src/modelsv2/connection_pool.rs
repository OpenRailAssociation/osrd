use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;
use diesel_async::AsyncPgConnection;

pub type ConnectionConfig = AsyncDieselConnectionManager<AsyncPgConnection>;
pub type ConnectionPool = Pool<Connection>;
pub type Connection = AsyncPgConnection;
