use diesel_async::AsyncPgConnection;
use diesel_async::pooled_connection::deadpool::Pool;

pub type Connection = AsyncPgConnection;
#[allow(dead_code)]
pub type ConnectionPool = Pool<Connection>;
