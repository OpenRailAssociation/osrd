use reqwest::Client;
use reqwest::ClientBuilder;
use reqwest::Method;
use reqwest::RequestBuilder;
use reqwest::Url;

use opentelemetry::global as otel;
use opentelemetry_http::HeaderInjector;

use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub trait HttpClientBuilder {
    fn build_base_url(self, base_url: Url) -> HttpClient;
}

impl HttpClientBuilder for ClientBuilder {
    fn build_base_url(self, base_url: Url) -> HttpClient {
        let client = self.build().expect("Could not build http client");
        HttpClient { client, base_url }
    }
}

#[derive(Debug, Clone)]
pub struct HttpClient {
    client: Client,
    base_url: Url,
}

impl HttpClient {
    pub fn request<P>(&self, method: Method, path: P) -> RequestBuilder
    where
        P: AsRef<str>,
    {
        let url = self
            .base_url
            .join(path.as_ref())
            .expect("Could not build url");
        self.client.request(method, url)
    }
}
