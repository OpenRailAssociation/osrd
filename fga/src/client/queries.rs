use crate::model::{AsUser, Relation, Tuple};

use super::{Client, RawTuple, RequestFailure};

#[derive(Debug, serde::Serialize)]
pub(super) struct ContextualTuples {
    tuple_keys: Vec<RawTuple>,
}

impl<'a, R: Relation, U: AsUser<User = R::User>> FromIterator<&'a Tuple<'a, R, U>>
    for ContextualTuples
{
    fn from_iter<I: IntoIterator<Item = &'a Tuple<'a, R, U>>>(iter: I) -> Self {
        Self {
            tuple_keys: iter.into_iter().map(RawTuple::from).collect(),
        }
    }
}

impl Client {
    pub(super) async fn post_stores_check(
        &self,
        store_id: &str,
        tuple: RawTuple,
        contextual_tuples: Option<ContextualTuples>,
        authorization_model_id: Option<String>,
    ) -> Result<bool, RequestFailure> {
        #[derive(serde::Serialize)]
        struct Request {
            tuple_key: RawTuple,
            #[serde(skip_serializing_if = "Option::is_none")]
            contextual_tuples: Option<ContextualTuples>,
            #[serde(skip_serializing_if = "Option::is_none")]
            authorization_model_id: Option<String>,
        }

        let request = Request {
            tuple_key: tuple,
            contextual_tuples,
            authorization_model_id,
        };

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/check").as_str())
            .unwrap();
        let response = self.inner.post(url).json(&request).send().await?;

        #[derive(serde::Deserialize)]
        struct Response {
            allowed: bool,
            #[expect(dead_code)]
            resolution: String,
        }

        let Response { allowed, .. } = response.error_for_status()?.json::<Response>().await?;

        Ok(allowed)
    }
}
