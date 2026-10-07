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

type Cursor = i64;

pub enum SelectionCursor {
    AfterCursor(Cursor),
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

pub struct PaginatedList {
    pub requests: Vec<StdcmRequest>,
    pub prev: Option<Cursor>,
    pub next: Option<Cursor>,
}

impl StdcmRequest {
    pub async fn list(
        conn: &mut DbConnection,
        selection_settings: SelectionSettings,
    ) -> Result<PaginatedList, crate::Error> {
        use database::tables::stdcm_request::dsl;
        use diesel::ExpressionMethods as _;
        use diesel::QueryDsl as _;
        use diesel_async::RunQueryDsl as _;
        use futures_util::TryStreamExt as _;
        use std::ops::DerefMut;

        let mut query = database::tables::stdcm_request::table.into_boxed();
        if let Some(user_ids) = selection_settings.user_filter {
            query = query.filter(dsl::created_by.eq_any(user_ids));
        }

        query = match selection_settings.cursor {
            Some(SelectionCursor::AfterCursor(id)) => {
                query.order_by(dsl::id.asc()).filter(dsl::id.gt(id))
            }
            Some(SelectionCursor::BeforeCursor(id)) => {
                query.order_by(dsl::id.desc()).filter(dsl::id.lt(id))
            }
            None => query.order_by(dsl::id.asc()),
        };

        tracing::Span::current().record("limit", selection_settings.limit);
        query = query.limit(selection_settings.limit as i64 + 1);

        let stream = query
            .load_stream::<(i64, String, i64, Option<String>)>(conn.write().await.deref_mut())
            .await
            .map_err(crate::Error::from)?;
        let mut requests =
            futures_util::TryStreamExt::map_ok(stream, |(id, rmi_id, created_by, trace_id)| {
                StdcmRequest {
                    id,
                    rmi_id,
                    created_by,
                    trace_id,
                }
            })
            .try_collect::<Vec<_>>()
            .await
            .map_err(crate::Error::from)?;

        let is_last_page = requests.len() != selection_settings.limit + 1;
        requests.truncate(selection_settings.limit);
        match selection_settings.cursor {
            Some(SelectionCursor::BeforeCursor(_)) => requests.reverse(),
            _ => (),
        }
        let requests = requests;

        if requests.len() == 0 {
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
            prev,
            next,
        })
    }
}

#[cfg(test)]
pub mod tests {
    use super::{SelectionSettings, StdcmRequest};
    use crate::{
        User,
        prelude::{Changeset, Create},
        stdcm_request::SelectionCursor::{AfterCursor, BeforeCursor},
    };
    use database::DbConnectionPoolV2;

    async fn request_fixture(
        db_pool: &mut DbConnectionPoolV2,
        rmi_id: &str,
        user_id: i64,
    ) -> StdcmRequest {
        Changeset::<StdcmRequest>::default()
            .rmi_id(rmi_id.to_string())
            .created_by(user_id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create stdcm request")
    }

    async fn user_fixture(db_pool: &mut DbConnectionPoolV2, username: &str) -> i64 {
        User::register(
            db_pool.get_ok(),
            vec![username.to_string()],
            username.to_string(),
        )
        .await
        .expect("Failed to register user")
        .id
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list() {
        let mut db_pool = DbConnectionPoolV2::for_tests();
        let user_id1 = user_fixture(&mut db_pool, "1").await;
        let user_id2 = user_fixture(&mut db_pool, "2").await;
        let created_requests = vec![
            request_fixture(&mut db_pool, "1_1", user_id1).await,
            request_fixture(&mut db_pool, "2_1", user_id2).await,
        ];
        let settings = SelectionSettings::new();
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        assert_eq!(listed_requests.requests, created_requests);
        assert_eq!(listed_requests.prev, None);
        assert_eq!(listed_requests.next, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_limited() {
        let mut db_pool = DbConnectionPoolV2::for_tests();
        let user_id1 = user_fixture(&mut db_pool, "1").await;
        let user_id2 = user_fixture(&mut db_pool, "2").await;
        let created_requests = vec![
            request_fixture(&mut db_pool, "1_1", user_id1).await,
            request_fixture(&mut db_pool, "2_1", user_id2).await,
        ];
        let settings = SelectionSettings::new().limit(1);
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_requests = vec![created_requests[0].clone()];
        assert_eq!(listed_requests.requests, expected_requests);
        assert_eq!(listed_requests.prev, None);
        assert_eq!(
            listed_requests.next.expect("Next cursor should be filled"),
            expected_requests[0].id
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_after() {
        let mut db_pool = DbConnectionPoolV2::for_tests();
        let user_id1 = user_fixture(&mut db_pool, "1").await;
        let user_id2 = user_fixture(&mut db_pool, "2").await;
        let created_requests = vec![
            request_fixture(&mut db_pool, "1_1", user_id1).await,
            request_fixture(&mut db_pool, "1_2", user_id1).await,
            request_fixture(&mut db_pool, "2_1", user_id2).await,
            request_fixture(&mut db_pool, "2_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .cursor(AfterCursor(created_requests[0].id))
            .limit(2);
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_requests = vec![created_requests[1].clone(), created_requests[2].clone()];
        assert_eq!(listed_requests.requests, expected_requests);
        assert_eq!(
            listed_requests.prev.expect("Prev cursor should be filled"),
            expected_requests[0].id
        );
        assert_eq!(
            listed_requests.next.expect("Next cursor should be filled"),
            expected_requests[1].id
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_paginated_before() {
        let mut db_pool = DbConnectionPoolV2::for_tests();
        let user_id1 = user_fixture(&mut db_pool, "1").await;
        let user_id2 = user_fixture(&mut db_pool, "2").await;
        let created_requests = vec![
            request_fixture(&mut db_pool, "1_1", user_id1).await,
            request_fixture(&mut db_pool, "1_2", user_id1).await,
            request_fixture(&mut db_pool, "2_1", user_id2).await,
            request_fixture(&mut db_pool, "2_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .cursor(BeforeCursor(created_requests[2].id))
            .limit(1);
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_requests = vec![created_requests[1].clone()];
        assert_eq!(listed_requests.requests, expected_requests);
        assert_eq!(
            listed_requests.prev.expect("Prev cursor should be filled"),
            expected_requests[0].id
        );
        assert_eq!(
            listed_requests.next.expect("Next cursor should be filled"),
            expected_requests[0].id
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_filtered() {
        let mut db_pool = DbConnectionPoolV2::for_tests();
        let user_id1 = user_fixture(&mut db_pool, "1").await;
        let user_id2 = user_fixture(&mut db_pool, "2").await;
        let user_id3 = user_fixture(&mut db_pool, "3").await;
        let created_requests = vec![
            request_fixture(&mut db_pool, "1_1", user_id1).await,
            request_fixture(&mut db_pool, "2_1", user_id2).await,
            request_fixture(&mut db_pool, "3_1", user_id3).await,
            request_fixture(&mut db_pool, "1_2", user_id1).await,
            request_fixture(&mut db_pool, "2_2", user_id2).await,
        ];
        let settings = SelectionSettings::new()
            .cursor(BeforeCursor(created_requests[3].id))
            .user_filter(vec![user_id1, user_id3]);
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        let expected_requests = vec![created_requests[0].clone(), created_requests[2].clone()];
        assert_eq!(listed_requests.requests, expected_requests);
        assert_eq!(listed_requests.prev, None);
        assert_eq!(
            listed_requests.next.expect("Next cursor should be filled"),
            expected_requests[1].id
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let settings = SelectionSettings::new();
        let listed_requests = StdcmRequest::list(&mut db_pool.get_ok(), settings)
            .await
            .expect("Failed to list stdcm requests");

        assert_eq!(listed_requests.requests, vec![]);
        assert_eq!(listed_requests.prev, None);
        assert_eq!(listed_requests.next, None);
    }
}
