use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::AsyncPgConnection;

pub type Connection = AsyncPgConnection;
pub type ConnectionPool = Pool<Connection>;
