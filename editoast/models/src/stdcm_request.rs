use bilrost::Message;
use bilrost::OwnedMessage as _;
use database::DbConnection;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema, PartialEq, Eq)]
#[model(table = database::tables::stdcm_request)]
#[model(gen(ops = cd))]
pub struct StdcmRequest {
    pub id: i64,
    pub rmi_id: String,
    pub created_by: i64,
    pub trace_id: Option<String>,
}
#[derive(Message)]
struct DecodedCursor(i64);

type Cursor = Vec<u8>;

/// Cursor used for pagination
#[derive(Debug)]
pub enum SelectionCursor {
    /// Select results with id strictly after the cursor
    AfterCursor(Cursor),
    /// Select results with id strictly before the cursor
    BeforeCursor(Cursor),
}

pub struct SelectionSettings {
    cursor: Option<SelectionCursor>,
    limit: usize,
    user_filter: Option<Vec<i64>>,
}

impl Default for SelectionSettings {
    fn default() -> Self {
        Self {
            cursor: None,
            limit: 200,
            user_filter: None,
        }
    }
}

impl SelectionSettings {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn cursor(self, cursor: SelectionCursor) -> Self {
        Self {
            cursor: Some(cursor),
            ..self
        }
    }
    pub fn limit(self, limit: usize) -> Self {
        Self { limit, ..self }
    }
    pub fn user_filter(self, user_ids: Vec<i64>) -> Self {
        Self {
            user_filter: Some(user_ids),
            ..self
        }
    }
}

#[cfg(test)]
impl SelectionSettings {
    pub fn decoded_after_cursor(self, id: i64) -> Self {
        Self {
            cursor: Some(SelectionCursor::AfterCursor(
                DecodedCursor(id).encode_to_vec(),
            )),
            ..self
        }
    }
    pub fn decoded_before_cursor(self, id: i64) -> Self {
        Self {
            cursor: Some(SelectionCursor::BeforeCursor(
                DecodedCursor(id).encode_to_vec(),
            )),
            ..self
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct PaginatedList {
    pub requests: Vec<StdcmRequest>,
    pub prev: Option<Cursor>,
    pub next: Option<Cursor>,
}

#[derive(thiserror::Error, derive_more::From, Debug)]
pub enum Error {
    #[error(transparent)]
    DecodeError(#[from] bilrost::DecodeError),
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

impl StdcmRequest {
    #[tracing::instrument(skip_all, fields(cursor = ?selection_settings.cursor, limit = selection_settings.limit, decoded_cursor, user_filter = ?selection_settings.user_filter))]
    pub async fn list(
        conn: &mut DbConnection,
        selection_settings: SelectionSettings,
    ) -> Result<PaginatedList, Error> {
        use database::tables::stdcm_request::dsl;
        use diesel::ExpressionMethods as _;
        use diesel::QueryDsl as _;
        use diesel_async::RunQueryDsl as _;
        use futures_util::TryStreamExt as _;
        use std::ops::DerefMut as _;

        let mut query = database::tables::stdcm_request::table.into_boxed();
        if let Some(user_ids) = selection_settings.user_filter {
            query = query.filter(dsl::created_by.eq_any(user_ids));
        }

        query = match &selection_settings.cursor {
            Some(SelectionCursor::AfterCursor(cursor)) => {
                let id = DecodedCursor::decode(cursor.as_slice())?.0;
                tracing::Span::current().record("decoded_cursor", id);
                query.order_by(dsl::id.asc()).filter(dsl::id.gt(id))
            }
            Some(SelectionCursor::BeforeCursor(cursor)) => {
                let id = DecodedCursor::decode(cursor.as_slice())?.0;
                tracing::Span::current().record("decoded_cursor", id);
                query.order_by(dsl::id.desc()).filter(dsl::id.lt(id))
            }
            None => query.order_by(dsl::id.asc()),
        };

        // We query one more than the limit to determine if there is a next page
        // If we get limit + 1 element back, there is a next page
        query = query.limit(selection_settings.limit as i64 + 1);

        let mut requests = query
            .load_stream::<(i64, String, i64, Option<String>)>(conn.write().await.deref_mut())
            .await
            .map_err(crate::Error::from)?
            .map_ok(|(id, rmi_id, created_by, trace_id)| StdcmRequest {
                id,
                rmi_id,
                created_by,
                trace_id,
            })
            .try_collect::<Vec<_>>()
            .await
            .map_err(crate::Error::from)?;

        let is_last_page = requests.len() != selection_settings.limit + 1;
        requests.truncate(selection_settings.limit); // Make sure we don't return the one extraneous element we queried for to check the next page
        if let Some(SelectionCursor::BeforeCursor(_)) = selection_settings.cursor {
            requests.reverse()
        }
        let requests = requests;

        if requests.is_empty() {
            return Ok(PaginatedList {
                requests: vec![],
                prev: None,
                next: None,
            });
        }

        let prev = match selection_settings.cursor {
            Some(SelectionCursor::AfterCursor(_)) => Some(requests[0].id),
            None => None,
            _ if is_last_page => None,
            _ => Some(requests[0].id),
        };

        let next = match selection_settings.cursor {
            Some(SelectionCursor::BeforeCursor(_)) => Some(requests[requests.len() - 1].id),
            _ if is_last_page => None,
            _ => Some(requests[requests.len() - 1].id),
        };

        Ok(PaginatedList {
            requests,
            prev: prev.map(|id| DecodedCursor(id).encode_to_vec()),
            next: next.map(|id| DecodedCursor(id).encode_to_vec()),
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::SelectionSettings;
    use super::StdcmRequest;
    use crate::User;
    use crate::prelude::Changeset;
    use crate::prelude::Create as _;
    use crate::stdcm_request::DecodedCursor;
    use crate::stdcm_request::PaginatedList;
    use bilrost::Message as _;
    use database::DbConnection;
    use database::DbConnectionPool;

    async fn request_fixture(conn: &mut DbConnection, rmi_id: &str, user_id: i64) -> StdcmRequest {
        Changeset::<StdcmRequest>::default()
            .rmi_id(rmi_id.to_string())
            .created_by(user_id)
            .create(conn)
            .await
            .expect("Failed to create stdcm request")
    }

    async fn user_fixture(conn: DbConnection, username: &str) -> User {
        User::register(conn, vec![username.to_string()], username.to_string())
            .await
            .expect("Failed to register user")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let created_requests = vec![
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
        ];
        let settings = SelectionSettings::new();
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: created_requests,
            prev: None,
            next: None,
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_empty() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let settings = SelectionSettings::new();
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![],
            prev: None,
            next: None,
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_limited() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
        ];
        let settings = SelectionSettings::new().limit(1);
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![created_requests[0].clone()],
            prev: None,
            next: Some(DecodedCursor(created_requests[0].id).encode_to_vec()),
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_after() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let created_requests: Vec<StdcmRequest> = vec![
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Alice_req_2", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
            request_fixture(&mut conn, "Bob_req_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .decoded_after_cursor(created_requests[0].id)
            .limit(2);
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![created_requests[1].clone(), created_requests[2].clone()],
            prev: Some(DecodedCursor(created_requests[1].id).encode_to_vec()),
            next: Some(DecodedCursor(created_requests[2].id).encode_to_vec()),
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_before() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Alice_req_2", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
            request_fixture(&mut conn, "Bob_req_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .decoded_before_cursor(created_requests[3].id)
            .limit(2);
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![created_requests[1].clone(), created_requests[2].clone()],
            prev: Some(DecodedCursor(created_requests[1].id).encode_to_vec()),
            next: Some(DecodedCursor(created_requests[2].id).encode_to_vec()),
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_before_same_prev_next() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Alice_req_2", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
            request_fixture(&mut conn, "Bob_req_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .decoded_before_cursor(created_requests[2].id)
            .limit(1);
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![created_requests[1].clone()],
            prev: Some(DecodedCursor(created_requests[1].id).encode_to_vec()),
            next: Some(DecodedCursor(created_requests[1].id).encode_to_vec()),
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_filtered() {
        let db_pool = DbConnectionPool::for_tests();
        let mut conn = db_pool.get_ok();
        let user_id1 = user_fixture(conn.clone(), "Alice").await.id;
        let user_id2 = user_fixture(conn.clone(), "Bob").await.id;
        let user_id3 = user_fixture(conn.clone(), "Charlie").await.id;
        let created_requests = [
            request_fixture(&mut conn, "Alice_req_1", user_id1).await,
            request_fixture(&mut conn, "Bob_req_1", user_id2).await,
            request_fixture(&mut conn, "Charlie_req_1", user_id3).await,
            request_fixture(&mut conn, "Alice_req_2", user_id1).await,
            request_fixture(&mut conn, "Bob_req_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .decoded_before_cursor(created_requests[3].id)
            .user_filter(vec![user_id1, user_id3]);
        let listed_requests = StdcmRequest::list(&mut conn, settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_paginated_list = PaginatedList {
            requests: vec![created_requests[0].clone(), created_requests[2].clone()],
            prev: None,
            next: Some(DecodedCursor(created_requests[2].id).encode_to_vec()),
        };
        assert_eq!(listed_requests, expected_paginated_list);
    }
}
