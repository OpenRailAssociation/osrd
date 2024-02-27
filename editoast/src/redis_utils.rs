use crate::client::RedisConfig;
use crate::error::Result;
use redis::aio::{ConnectionLike, ConnectionManager};
use redis::cluster::ClusterClient;
use redis::cluster_async::ClusterConnection;
use redis::Client;
use redis::RedisResult;

pub enum RedisConnection {
    Cluster(ClusterConnection),
    Tokio(ConnectionManager),
}

impl ConnectionLike for RedisConnection {
    fn req_packed_command<'a>(
        &'a mut self,
        cmd: &'a redis::Cmd,
    ) -> redis::RedisFuture<'a, redis::Value> {
        match self {
            RedisConnection::Cluster(connection) => connection.req_packed_command(cmd),
            RedisConnection::Tokio(connection) => connection.req_packed_command(cmd),
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a redis::Pipeline,
        offset: usize,
        count: usize,
    ) -> redis::RedisFuture<'a, Vec<redis::Value>> {
        match self {
            RedisConnection::Cluster(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            RedisConnection::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            RedisConnection::Cluster(connection) => connection.get_db(),
            RedisConnection::Tokio(connection) => connection.get_db(),
        }
    }
}

#[derive(Clone)]
pub enum RedisClient {
    Cluster(ClusterClient),
    Tokio(Client),
}

impl RedisClient {
    pub fn new(redis_config: RedisConfig) -> Result<RedisClient> {
        let redis_config_url = redis_config.url()?;
        if redis_config.is_cluster_client {
            return Ok(RedisClient::Cluster(
                redis::cluster::ClusterClient::new(vec![redis_config_url.as_str()]).unwrap(),
            ));
        }
        Ok(RedisClient::Tokio(
            redis::Client::open(redis_config_url.as_str()).unwrap(),
        ))
    }

    pub async fn get_connection(&self) -> RedisResult<RedisConnection> {
        match self {
            RedisClient::Cluster(client) => Ok(RedisConnection::Cluster(
                client.get_async_connection().await?,
            )),
            RedisClient::Tokio(client) => Ok(RedisConnection::Tokio(
                client.get_connection_manager().await?,
            )),
        }
    }
}
