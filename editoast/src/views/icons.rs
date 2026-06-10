use axum::extract::Path;
use axum::extract::Request;
use axum::extract::State;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use thiserror::Error;
use tower::ServiceExt;
use tower_http::services::ServeFile;

use crate::AppState;
use crate::error::Result;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "icons")]
enum IconErrors {
    #[error("File '{file}' not found")]
    #[editoast_error(status = 404)]
    FileNotFound { file: String },
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "icons",
    params(
        ("signaling_system" = String, Path, description = "Signaling system name"),
        ("file_name" = String, Path, description = "File name (svg)"),
    ),
    responses(
        (status = 200, description = "The requested icon"),
    ),
)]
pub(in crate::views) async fn icons(
    Path((signaling_system, file_name)): Path<(String, String)>,
    State(AppState { config, .. }): State<AppState>,
    request: Request,
) -> Result<impl IntoResponse> {
    let path = config
        .dynamic_assets_path
        .join(format!("icons/{signaling_system}/{file_name}"));

    if !path.is_file() {
        return Err(IconErrors::FileNotFound { file: file_name }.into());
    }

    // Avoid path traversal attack by ensuring the path is within the dynamic assets directory
    let canonical_path = path.canonicalize().unwrap();
    let canonical_assets_path = config.dynamic_assets_path.canonicalize().unwrap();
    if !canonical_path.starts_with(&canonical_assets_path) {
        return Err(IconErrors::FileNotFound { file: file_name }.into());
    }

    Ok(ServeFile::new(&path).oneshot(request).await)
}

#[cfg(test)]
mod tests {
    use crate::views::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_icons() {
        let app = test_app!().skip_authz().build();
        let response = app.get("/icons/TVM300/REP%20TGV.svg").await;
        response.assert_status_ok();
        assert_eq!("image/svg+xml", response.content_type());
        let response = response.into_bytes();
        let expected = std::fs::read(
            app.config()
                .dynamic_assets_path
                .join("icons/TVM300/REP TGV.svg"),
        )
        .unwrap();
        assert_eq!(response, expected);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_icons_not_found() {
        let app = test_app!().skip_authz().build();
        app.get("/icons/TVM300/NOT_A_THING.svg")
            .await
            .assert_status_not_found();
    }
}
