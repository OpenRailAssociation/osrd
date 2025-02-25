use crate::model::AsUser;
use crate::model::Relation;
use crate::model::Tuple;

use super::Client;
use super::Consistency;
use super::RawTuple;
use super::RequestFailure;

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

#[derive(Debug, serde::Serialize)]
#[serde(untagged)]
pub(super) enum UserFilter<'a> {
    User { r#type: &'a str },
    UserSet { r#type: &'a str, relation: &'a str },
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum RawUser {
    Object {
        r#type: String,
        id: String,
    },
    UserSet {
        r#type: String,
        id: String,
        relation: String,
    },
    Wildcard {
        r#type: String,
    },
}

impl Client {
    #[tracing::instrument(skip(self), ret(level = "debug") err)]
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

    #[tracing::instrument(skip(self), err)]
    pub(super) async fn post_stores_list_objects(
        &self,
        store_id: &str,
        type_: &str,
        relation: &str,
        user: &str,
        contextual_tuples: Option<ContextualTuples>,
        consistency: Option<Consistency>,
    ) -> Result<Vec<String>, RequestFailure> {
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
        let response = self.inner.post(url).json(&request).send().await?;

        #[derive(serde::Deserialize)]
        struct Response {
            objects: Vec<String>,
        }

        let Response { objects } = response.error_for_status()?.json::<Response>().await?;

        tracing::debug!(count = objects.len(), "objects found");
        Ok(objects)
    }

    #[tracing::instrument(skip(self), err)]
    pub(super) async fn post_stores_list_users(
        &self,
        store_id: &str,
        (object_type, object_id): (&str, &str),
        relation: &str,
        user_filter: UserFilter<'_>,
        contextual_tuples: Option<ContextualTuples>,
        authorization_model_id: Option<&str>,
        consistency: Option<Consistency>,
    ) -> Result<Vec<RawUser>, RequestFailure> {
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
        let response = self.inner.post(url).json(&request).send().await?;

        #[derive(serde::Deserialize)]
        struct Response {
            users: Vec<RawUser>,
        }

        let Response { users } = response.error_for_status()?.json().await?;
        Ok(users)
    }
}
