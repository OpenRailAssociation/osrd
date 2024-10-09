use std::collections::BTreeMap;

use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::{Method, Request, StatusCode};
use serde::{Deserialize, Serialize};

use crate::config::OsrdyneConfig;

pub struct ManagementClient {
    client: reqwest::Client,
    base: url::Url,
    user: String,
    password: String,
    vhost: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum ArgumentValue {
    Int(usize),
    String(String),
}

type Arguments = BTreeMap<String, ArgumentValue>;

#[derive(Deserialize, Debug)]
pub struct Queue {
    pub arguments: Arguments,
    pub auto_delete: bool,
    pub durable: bool,
    pub exclusive: bool,
    pub name: String,
    pub node: String,
    pub state: String,
    pub r#type: String,
    pub vhost: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub enum PolicyScope {
    /// applies to exchanges only
    #[serde(rename = "exchanges")]
    Exchanges,
    /// applies to all types of queues, including streams
    #[serde(rename = "queues")]
    Queues,
    /// applies to classic queues only
    #[serde(rename = "classic_queues")]
    ClassicQueues,
    /// applies to quorum queues only
    #[serde(rename = "quorum_queues")]
    QuorumQueues,
    /// applies to streams only
    #[serde(rename = "streams")]
    Streams,
    /// applies to all exchanges and queues (including streams)
    #[serde(rename = "all")]
    All,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Policy {
    pub pattern: String,
    pub definition: Arguments,
    pub priority: Option<usize>,
    pub apply_to: Option<PolicyScope>,
}

impl ManagementClient {
    pub fn try_from(config: &OsrdyneConfig) -> Result<Self, anyhow::Error> {
        // Parse the AMQP URI to extract the vhost
        let parsed_amqp_uri = url::Url::parse(&config.amqp_uri)?;
        // Parse the management URI to extract the base URL, user and password
        let parsed_uri = url::Url::parse(&config.management_uri)?;

        if parsed_uri.cannot_be_a_base() {
            anyhow::bail!("invalid URL format");
        }

        let vhost = match parsed_amqp_uri.path() {
            "" => "%2f", // that's the default
            s => &s[1..],
        };

        let password = parsed_uri.password().unwrap_or("guest");
        let user = match parsed_uri.username() {
            "" => "guest",
            username => username,
        };

        let recomposed_base_uri = format!(
            "{}://{}:{}",
            parsed_uri.scheme(),
            parsed_uri.host_str().unwrap(),
            parsed_uri.port().unwrap_or(15672)
        );

        Ok(Self {
            client: reqwest::Client::new(),
            base: recomposed_base_uri.parse()?,
            user: user.into(),
            password: password.into(),
            vhost: vhost.into(),
        })
    }

    pub fn make_request(
        &self,
        method: Method,
        rel_url: impl AsRef<str>,
    ) -> anyhow::Result<Request> {
        let url = self.base.join(rel_url.as_ref())?;
        let username = self.user.clone();
        let password = self.password.clone();
        let request = self
            .client
            .request(method, url)
            .basic_auth(username, Some(password))
            .build()?;
        Ok(request)
    }

    pub async fn list_queues(&self) -> anyhow::Result<Vec<Queue>> {
        let path = format!("/api/queues/{}?disable_stats=true", self.vhost);
        let req = self.make_request(Method::GET, path)?;
        let resp = self.client.execute(req).await?;
        let resp = resp.error_for_status()?;
        Ok(resp.json().await?)
    }

    fn policy_path(&self, policy_id: String) -> String {
        let encoded_policy_id = utf8_percent_encode(&policy_id, NON_ALPHANUMERIC);
        format!("/api/policies/{}/{}", self.vhost, encoded_policy_id)
    }

    pub async fn set_policy(&self, policy_id: String, policy: Policy) -> anyhow::Result<()> {
        let mut req = self.make_request(Method::PUT, self.policy_path(policy_id))?;
        *req.body_mut() = Some(serde_json::to_string(&policy)?.into());
        let resp = self.client.execute(req).await?;
        resp.error_for_status()?;
        Ok(())
    }

    pub async fn remove_policy(&self, policy_id: String) -> anyhow::Result<()> {
        let path = self.policy_path(policy_id);
        let req = self.make_request(Method::DELETE, path)?;
        let resp = self.client.execute(req).await?;
        if resp.status() == StatusCode::NOT_FOUND {
            return Ok(());
        }
        resp.error_for_status()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn try_from_standard_config() {
        let amqp_uri = "amqp://osrd:password@osrd-rabbitmq:5672/%2f";
        let mgmt_uri = "http://osrd1:password1@osrd-rabbitmq:15672";
        let config = OsrdyneConfig {
            amqp_uri: amqp_uri.into(),
            management_uri: mgmt_uri.into(),
            ..Default::default()
        };

        let client = ManagementClient::try_from(&config).expect("failed to create client");

        assert_eq!(client.user, "osrd1");
        assert_eq!(client.password, "password1");
        assert_eq!(client.vhost, "%2f");
        assert_eq!("http://osrd-rabbitmq:15672/", client.base.as_str());
    }

    #[test]
    fn try_from_host_mode_config() {
        let amqp_uri = "amqp://osrd:password@127.0.0.1:5672/%2f";
        let mgmt_uri = "http://osrd1:password1@127.0.0.1:15672";
        let config = OsrdyneConfig {
            amqp_uri: amqp_uri.into(),
            management_uri: mgmt_uri.into(),
            ..Default::default()
        };

        let client = ManagementClient::try_from(&config).expect("failed to create client");
        assert_eq!(client.user, "osrd1");
        assert_eq!(client.password, "password1");
        assert_eq!(client.vhost, "%2f");
        assert_eq!("http://127.0.0.1:15672/", client.base.as_str());
    }

    #[test]
    fn try_from_no_port_given() {
        let amqp_uri = "amqp://osrd:password@127.0.0.1:5672/%2f";
        let mgmt_uri = "http://osrd1:password1@127.0.0.1";
        let config = OsrdyneConfig {
            amqp_uri: amqp_uri.into(),
            management_uri: mgmt_uri.into(),
            ..Default::default()
        };

        let client = ManagementClient::try_from(&config).expect("failed to create client");
        assert_eq!(client.user, "osrd1");
        assert_eq!(client.password, "password1");
        assert_eq!(client.vhost, "%2f");
        assert_eq!("http://127.0.0.1:15672/", client.base.as_str());
    }
}
