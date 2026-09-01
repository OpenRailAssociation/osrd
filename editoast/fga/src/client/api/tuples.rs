use itertools::Itertools;

use crate::model::AsUser;
use crate::model::Object as _;
use crate::model::Relation;
use crate::model::Tuple;
use crate::model::Type;

use super::super::Client;
use super::super::Consistency;
use super::super::Error;
use super::Message;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub(in crate::client) struct RawTuple {
    pub(in crate::client) user: String,
    pub(in crate::client) relation: String,
    pub(in crate::client) object: String,
}

/// Untyped tuple that can be cast to a typed relation
#[derive(Debug, Clone)]
pub struct UntypedTuple {
    user: String,
    relation: String,
    object: String,
}

#[derive(Debug, Clone)]
pub enum UserOrUserset<R: Relation> {
    /// Direct user
    User(R::User),
    /// [Userset] `"type:id#relation"`
    ///
    /// [Userset]: https://openfga.dev/docs/modeling/building-blocks/usersets
    Userset(UntypedUserset),
}

/// A [userset] reference extracted from an untyped tuple
///
/// [userset]: https://openfga.dev/docs/modeling/building-blocks/usersets
#[derive(Debug, Clone)]
pub struct UntypedUserset {
    type_name: String,
    id: String,
}

impl UntypedUserset {
    /// Tries to parse the userset's object as a specific type `T`
    pub fn as_type<T: Type>(&self) -> Option<T> {
        if self.type_name != T::NAMESPACE {
            return None;
        }
        self.id.parse().ok()
    }
}

impl UntypedTuple {
    /// Casts the untyped tuple to a typed relation.
    pub fn as_relation<R: Relation>(&self, _relation: R) -> Option<(UserOrUserset<R>, R::Object)> {
        if self.relation != R::NAME {
            return None;
        }

        let object = self
            .object
            .strip_prefix(&format!("{}:", R::Object::NAMESPACE))?
            .parse()
            .ok()?;

        let user = if let Some((object_part, _relation)) = self.user.split_once('#') {
            let (type_name, id) = object_part.split_once(':')?;
            UserOrUserset::Userset(UntypedUserset {
                type_name: type_name.to_string(),
                id: id.to_string(),
            })
        } else {
            let id_str = self
                .user
                .strip_prefix(&format!("{}:", R::User::NAMESPACE))?;
            UserOrUserset::User(id_str.parse().ok()?)
        };

        Some((user, object))
    }
}

impl From<RawTuple> for UntypedTuple {
    fn from(raw: RawTuple) -> Self {
        UntypedTuple {
            user: raw.user,
            relation: raw.relation,
            object: raw.object,
        }
    }
}

impl From<UntypedTuple> for RawTuple {
    fn from(untyped: UntypedTuple) -> Self {
        RawTuple {
            user: untyped.user,
            relation: untyped.relation,
            object: untyped.object,
        }
    }
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
    pub(in crate::client) async fn get_stores_read(
        &self,
        store_id: &str,
        tuple_key: Option<RawTuple>,
        page_size: Option<usize>,
        authorization_model_id: Option<&str>,
        consistency: Option<Consistency>,
        continuation_token: Option<String>,
    ) -> Result<(Vec<RawTuple>, String), Error> {
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

        let response = self
            .fetch(self.inner.post(url).json(&Request {
                tuple_key,
                page_size,
                authorization_model_id,
                consistency,
                continuation_token,
            }))
            .await?;
        let Response {
            tuples,
            continuation_token,
        } = response.json::<Message<_>>().await?.try_success()?;

        let tuples = tuples.into_iter().map(|t| t.key).collect_vec();
        Ok((tuples, continuation_token))
    }

    // It's fine to request tuples to be mapped into `RawTuple` as OpenFGA
    // doesn't support more than 100 tuples in the request. So mapping 100 objects
    // max is fine—we'll always be bounded by the network call.
    #[tracing::instrument(skip(self, writes, deletes), err)]
    pub(in crate::client) async fn post_stores_write(
        &self,
        store_id: &str,
        writes: &[RawTuple],
        deletes: &[RawTuple],
        authorization_model_id: Option<String>,
    ) -> Result<(), Error> {
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
        let response = self
            .fetch(self.inner.post(url).json(&Request {
                writes: Writes { tuple_keys: writes },
                deletes: Deletes {
                    tuple_keys: deletes,
                },
                authorization_model_id,
            }))
            .await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(response.json::<Error>().await?)
        }
    }
}
