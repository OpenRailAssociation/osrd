use std::collections::HashMap;

use super::{IdentityProvider, ProviderIdentityStatus};
use actix_web::HttpRequest;
use actix_web_httpauth::headers::authorization::{self as auth_headers, Scheme};

#[derive(Clone)]
pub struct BearerProvider {
    pub allowed_tokens: HashMap<String, String>,
}

impl BearerProvider {
    pub fn new(allowed_tokens: HashMap<String, String>) -> Self {
        Self { allowed_tokens }
    }
}

impl IdentityProvider for BearerProvider {
    fn get_identity(&self, req: &HttpRequest) -> ProviderIdentityStatus {
        let header = match req.headers().get(actix_web::http::header::AUTHORIZATION) {
            Some(header) => header,
            None => return ProviderIdentityStatus::Unknown,
        };

        let bearer = match auth_headers::Bearer::parse(header) {
            Ok(bearer) => bearer,
            Err(_) => {
                return ProviderIdentityStatus::Error("invalid HTTP Authorization Bearer token");
            }
        };

        if let Some(token_id) = self.allowed_tokens.get(bearer.token()) {
            ProviderIdentityStatus::Known {
                user_id: token_id.clone(),
                username: None,
            }
        } else {
            ProviderIdentityStatus::Error("unknown HTTP Authorization Bearer token")
        }
    }
}
