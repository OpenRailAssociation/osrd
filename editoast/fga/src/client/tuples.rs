use itertools::Itertools;

use crate::model::AsUser;
use crate::model::Object as _;
use crate::model::Relation;
use crate::model::Tuple;

use super::Client;
use super::Consistency;
use super::RequestFailure;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub(super) struct RawTuple {
    pub(super) user: String,
    pub(super) relation: String,
    pub(super) object: String,
}

impl<'a, R: Relation, U: AsUser<User = R::User>> From<&Tuple<'a, R, U>> for RawTuple {
    fn from(tuple: &Tuple<'a, R, U>) -> Self {
        RawTuple {
            user: tuple.user.fga_user(),
            relation: R::NAME.to_string(),
            object: tuple.object.fga_object(),
        }
    }
}

impl Client {
    #[tracing::instrument(skip(self), err)]
    pub(super) async fn get_stores_read(
        &self,
        store_id: &str,
        tuple_key: Option<RawTuple>,
        page_size: Option<usize>,
        authorization_model_id: Option<&str>,
        consistency: Option<Consistency>,
        continuation_token: Option<String>,
    ) -> Result<(Vec<RawTuple>, String), RequestFailure> {
        #[derive(serde::Serialize)]
        struct Request<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            tuple_key: Option<RawTuple>,
            #[serde(skip_serializing_if = "Option::is_none")]
            page_size: Option<usize>,
            #[serde(skip_serializing_if = "Option::is_none")]
            authorization_model_id: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            consistency: Option<Consistency>,
            #[serde(skip_serializing_if = "Option::is_none")]
            continuation_token: Option<String>,
        }

        #[derive(serde::Deserialize)]
        struct Response {
            tuples: Vec<TupleResponse>,
            #[serde(default)]
            continuation_token: String,
        }

        #[derive(serde::Deserialize)]
        struct TupleResponse {
            key: RawTuple,
            // timestamp — not needed for our use case
        }

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/read").as_str())
            .unwrap();

        let Response {
            tuples,
            continuation_token,
        } = self
            .inner
            .post(url)
            .json(&Request {
                tuple_key,
                page_size,
                authorization_model_id,
                consistency,
                continuation_token,
            })
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        let tuples = tuples.into_iter().map(|t| t.key).collect_vec();
        Ok((tuples, continuation_token))
    }

    // It's fine to request tuples to be mapped into `RawTuple` as OpenFGA
    // doesn't support more than 100 tuples in the request. So mapping 100 objects
    // max is fine—we'll always be bounded by the network call.
    #[tracing::instrument(skip(self, writes, deletes), err)]
    pub(super) async fn post_stores_write(
        &self,
        store_id: &str,
        writes: &[RawTuple],
        deletes: &[RawTuple],
        authorization_model_id: Option<String>,
    ) -> Result<(), RequestFailure> {
        #[derive(serde::Serialize)]
        struct Request<'a> {
            #[serde(skip_serializing_if = "Writes::is_empty")]
            writes: Writes<'a>,
            #[serde(skip_serializing_if = "Deletes::is_empty")]
            deletes: Deletes<'a>,
            #[serde(skip_serializing_if = "Option::is_none")]
            authorization_model_id: Option<String>,
        }

        #[derive(serde::Serialize)]
        struct Writes<'a> {
            tuple_keys: &'a [RawTuple],
        }

        impl Writes<'_> {
            fn is_empty(&self) -> bool {
                self.tuple_keys.is_empty()
            }
        }

        #[derive(serde::Serialize)]
        struct Deletes<'a> {
            tuple_keys: &'a [RawTuple],
        }

        impl Deletes<'_> {
            fn is_empty(&self) -> bool {
                self.tuple_keys.is_empty()
            }
        }

        if !writes.is_empty() {
            tracing::debug!(writes = writes.len(), "writing tuples");
        }
        if !deletes.is_empty() {
            tracing::debug!(deletes = deletes.len(), "deleting tuples");
        }

        let url = self
            .base_url()
            .join(format!("stores/{store_id}/write").as_str())
            .unwrap();
        self.inner
            .post(url)
            .json(&Request {
                writes: Writes { tuple_keys: writes },
                deletes: Deletes {
                    tuple_keys: deletes,
                },
                authorization_model_id,
            })
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }
}
