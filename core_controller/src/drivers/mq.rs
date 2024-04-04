use reqwest::Client;
use reqwest::Method;
use serde::{de, Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RabbitMQDriverOptions {
    pub api_url: String,
    pub vhost: String,
    pub exchange: String,
    pub queue_prefix: String,
}

pub struct RabbitMQDriver {
    options: RabbitMQDriverOptions,
}

#[derive(Debug, Serialize, Deserialize)]
struct RabbitMQResponseListQueues {
    pub name: String,
    pub messages: Option<u64>, // This field is optional because it is not present in the response when the queue is creating
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Queue {
    pub queue_name: String,
    pub infra_id: usize,
    pub pending_messages: u64,
}

impl RabbitMQDriver {
    pub fn new(options: RabbitMQDriverOptions) -> Self {
        RabbitMQDriver { options }
    }

    pub async fn request_api<TB>(
        &self,
        verb: String,
        path: String,
        body: Option<TB>,
    ) -> Result<(), reqwest::Error>
    where
        TB: Serialize,
    {
        let client = Client::new();
        let url = format!("{}/{}", self.options.api_url, path);

        let method = Method::from_bytes(verb.as_bytes()).unwrap();

        let mut request = client.request(method, url);
        if let Some(body) = body {
            request = request.json(&body);
        }

        request.send().await?;
        Ok(())
    }

    pub async fn query_api<TB, TR>(
        &self,
        verb: String,
        path: String,
        body: Option<TB>,
    ) -> Result<TR, reqwest::Error>
    where
        TB: Serialize,
        for<'de> TR: de::Deserialize<'de>,
    {
        let client = Client::new();
        let url = format!("{}/{}", self.options.api_url, path);

        let method = Method::from_bytes(verb.as_bytes()).unwrap();

        let mut request = client.request(method, url);
        if let Some(body) = body {
            request = request.json(&body);
        }

        let response = request.send().await?;
        let response_body = response.json().await?;

        Ok(response_body)
    }

    /// List all queues in the RabbitMQ server that have the prefix `options.queue_prefix`
    pub async fn list_core_queues(&self) -> Result<Vec<Queue>, reqwest::Error> {
        let response: Vec<RabbitMQResponseListQueues> = self
            .query_api(
                "GET".to_string(),
                format!("queues/{}", self.options.vhost),
                None::<()>,
            )
            .await?;

        let queues: Vec<Queue> = response
            .into_iter()
            .filter_map(|queue| {
                if let Some(queue_messages) = queue.messages {
                    if queue.name.starts_with(&self.options.queue_prefix) {
                        Some(Queue {
                            queue_name: queue.name.clone(),
                            infra_id: queue
                                .name
                                .replace(&self.options.queue_prefix, "")
                                .replace("-", "")
                                .parse()
                                .expect("Failed to parse infra_id"),
                            pending_messages: queue_messages,
                        })
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        Ok(queues)
    }

    /// Delete a queue from the RabbitMQ server
    pub async fn delete_queue(&self, infra_id: usize) -> Result<(), reqwest::Error> {
        self.request_api(
            "DELETE".to_string(),
            format!(
                "queues/{}/{}-{}",
                self.options.vhost, self.options.queue_prefix, infra_id
            ),
            None::<()>,
        )
        .await?;

        Ok(())
    }
}
