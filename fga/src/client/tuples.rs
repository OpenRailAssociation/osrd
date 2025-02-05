use crate::model::{AsUser, Object as _, Relation, Tuple};

use super::{Client, RequestFailure};

#[derive(Debug, serde::Serialize)]
pub(super) struct RawTuple {
    pub(super) user: String,
    pub(super) relation: String,
    pub(super) object: String,
}

impl<'a, R: Relation, U: AsUser<User = R::User>> From<&Tuple<'a, R, U>> for RawTuple {
    fn from(tuple: &Tuple<'a, R, U>) -> Self {
        RawTuple {
            user: tuple.user.fga_ident(),
            relation: R::NAME.to_string(),
            object: tuple.object.fga_ident(),
        }
    }
}

impl Client {
    // It's fine to request tuples to be mapped into `RawTuple` as OpenFGA
    // doesn't support more than 100 tuples in the request. So mapping 100 objects
    // max is fine—we'll always be bounded by the network call.
    pub(super) async fn post_stores_write<'a>(
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

        impl<'a> Writes<'a> {
            fn is_empty(&self) -> bool {
                self.tuple_keys.is_empty()
            }
        }

        #[derive(serde::Serialize)]
        struct Deletes<'a> {
            tuple_keys: &'a [RawTuple],
        }

        impl<'a> Deletes<'a> {
            fn is_empty(&self) -> bool {
                self.tuple_keys.is_empty()
            }
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
