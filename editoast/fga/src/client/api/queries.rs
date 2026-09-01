use std::collections::HashMap;

use crate::client::api::Message;
use crate::model::AsUser;
use crate::model::Relation;
use crate::model::Tuple;

use super::super::Client;
use super::super::Consistency;
use super::super::Error;

use super::tuples::RawTuple;

#[derive(Debug, serde::Serialize)]
pub(in crate::client) struct ContextualTuples {
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

#[derive(Debug, serde::Serialize)]
#[serde(untagged)]
pub(in crate::client) enum UserFilter<'a> {
    User { r#type: &'a str },
    Userset { r#type: &'a str, relation: &'a str },
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub(in crate::client) enum RawUser {
    Object {
        r#type: String,
        id: String,
    },
    Userset {
        r#type: String,
        id: String,
        relation: String,
    },
    Wildcard {
        r#type: String,
    },
}

#[derive(Debug, serde::Serialize)]
pub(in crate::client) struct BatchCheckItem {
    pub(in crate::client) correlation_id: String,
    pub(in crate::client) tuple_key: RawTuple,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(in crate::client) contextual_tuples: Option<ContextualTuples>,
}

#[derive(Debug, serde::Deserialize)]
pub(in crate::client) struct BatchCheckSingleResult {
    pub(in crate::client) allowed: bool,
    pub(in crate::client) error: Option<CheckError>,
}

#[derive(Debug, serde::Deserialize)]
pub(in crate::client) struct CheckError {
    pub(in crate::client) message: String,
    // other schema fields are left out (input_error and internal_error)
}

impl Client {
    #[tracing::instrument(skip(self, checks), ret(level = "debug"), err)]
    pub(in crate::client) async fn post_stores_batch_check(
        &self,
        store_id: &str,
        checks: &[BatchCheckItem],
        authorization_model_id: Option<&str>,
        consistency: Option<Consistency>,
    ) -> Result<HashMap<String, BatchCheckSingleResult>, Error> {
        assert!(
            checks.len() as u32 <= self.settings.limits.max_checks_per_batch_check,
            "OpenFGA client's checks limit per batch setting is set to {}",
            self.settings.limits.max_checks_per_batch_check
        );

        #[derive(serde::Serialize)]
        struct Request<'a> {
            checks: &'a [BatchCheckItem],
            #[serde(skip_serializing_if = "Option::is_none")]
            authorization_model_id: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            consistency: Option<Consistency>,
        }

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/batch-check").as_str())
            .unwrap();
        let response = self
            .fetch(self.inner.post(url).json(&Request {
                checks,
                authorization_model_id,
                consistency,
            }))
            .await?;

        #[derive(serde::Deserialize)]
        struct Response {
            result: HashMap<String, BatchCheckSingleResult>,
        }
        let Response { result } = response.json::<Message<_>>().await?.try_success()?;
        Ok(result)
    }

    #[tracing::instrument(skip(self), ret(level = "debug"), err)]
    pub(in crate::client) async fn post_stores_check(
        &self,
        store_id: &str,
        tuple: RawTuple,
        contextual_tuples: Option<ContextualTuples>,
        authorization_model_id: Option<String>,
    ) -> Result<bool, Error> {
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
        let response = self.fetch(self.inner.post(url).json(&request)).await?;

        #[derive(serde::Deserialize)]
        struct Response {
            allowed: bool,
            #[expect(dead_code)]
            resolution: String,
        }

        let Response { allowed, .. } = response.json::<Message<_>>().await?.try_success()?;

        Ok(allowed)
    }

    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn post_stores_list_objects(
        &self,
        store_id: &str,
        type_: &str,
        relation: &str,
        user: &str,
        contextual_tuples: Option<ContextualTuples>,
        consistency: Option<Consistency>,
    ) -> Result<Vec<String>, Error> {
        #[derive(serde::Serialize)]
        struct Request {
            #[serde(rename = "type")]
            type_: String,
            relation: String,
            user: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            contextual_tuples: Option<ContextualTuples>,
            #[serde(skip_serializing_if = "Option::is_none")]
            consistency: Option<Consistency>,
        }

        let request = Request {
            type_: type_.to_string(),
            relation: relation.to_string(),
            user: user.to_string(),
            contextual_tuples,
            consistency,
        };

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/list-objects").as_str())
            .unwrap();
        let response = self.fetch(self.inner.post(url).json(&request)).await?;

        #[derive(serde::Deserialize)]
        struct Response {
            objects: Vec<String>,
        }

        let Response { objects } = response.json::<Message<_>>().await?.try_success()?;

        tracing::debug!(count = objects.len(), "objects found");
        Ok(objects)
    }

    #[expect(clippy::too_many_arguments)] // by design of the function: 1 to 1 mapping of the API
    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn post_stores_list_users(
        &self,
        store_id: &str,
        (object_type, object_id): (&str, &str),
        relation: &str,
        user_filter: UserFilter<'_>,
        contextual_tuples: Option<ContextualTuples>,
        authorization_model_id: Option<&str>,
        consistency: Option<Consistency>,
    ) -> Result<Vec<RawUser>, Error> {
        #[derive(serde::Serialize)]
        struct Request<'a> {
            authorization_model_id: Option<String>,
            object: Object<'a>,
            relation: String,
            user_filters: Vec<UserFilter<'a>>,
            #[serde(skip_serializing_if = "Option::is_none")]
            contextual_tuples: Option<ContextualTuples>,
            #[serde(skip_serializing_if = "Option::is_none")]
            consistency: Option<Consistency>,
        }

        #[derive(serde::Serialize)]
        struct Object<'a> {
            r#type: &'a str,
            id: &'a str,
        }

        let request = Request {
            authorization_model_id: authorization_model_id.map(String::from),
            object: Object {
                r#type: object_type,
                id: object_id,
            },
            relation: relation.to_owned(),
            user_filters: vec![user_filter],
            contextual_tuples,
            consistency,
        };

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/list-users").as_str())
            .unwrap();
        let response = self.fetch(self.inner.post(url).json(&request)).await?;

        #[derive(serde::Deserialize)]
        struct Response {
            users: Vec<RawUser>,
        }

        let Response { users } = response.json::<Message<_>>().await?.try_success()?;
        Ok(users)
    }
}
