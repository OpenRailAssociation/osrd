use actix_web::web::{Data, Json};
use derivative::Derivative;
use serde::{Deserialize, Serialize};

use crate::{error::Result, models::Infra, DbPool};

use super::{AsCoreRequest, CoreClient};

/// A Core infra load request
#[derive(Debug, Serialize)]
pub struct InfraLoadRequest {
    pub infra: i64,
    pub expected_version: String,
}

impl AsCoreRequest<()> for InfraLoadRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/infra_load";
}
