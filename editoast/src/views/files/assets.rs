use axum::extract::Path;
use axum::extract::Request;
use axum::extract::State;
use axum::response::IntoResponse;
use tower::ServiceExt as _;
use tower_http::services::ServeFile;

use crate::AppState;
use crate::views::files::FileNotFoundError;

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "assets",
    params(
        ("*file_path" = String, Path, description = "File path"),
    ),
    responses(
        (status = 200, description = "The requested asset"),
        FileNotFoundError,
    ),
)]
#[tracing::instrument(level = "debug", skip_all, fields(file_path = %file_path))]
pub(in crate::views) async fn get(
    Path(file_path): Path<String>,
    State(AppState { config, .. }): State<AppState>,
    request: Request,
) -> Result<impl IntoResponse, FileNotFoundError> {
    let path = config.dynamic_assets_path.join(&file_path);
    if !path.is_file() {
        return Err(FileNotFoundError { file: file_path });
    }

    // Avoid path traversal attack by ensuring the path is within the dynamic assets directory
    let canonical_path = path.canonicalize().unwrap();
    let canonical_assets_path = config.dynamic_assets_path.canonicalize().unwrap();
    if !canonical_path.starts_with(&canonical_assets_path) {
        return Err(FileNotFoundError { file: file_path });
    }

    Ok(ServeFile::new(&path).oneshot(request).await)
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use crate::views::test_app;

    #[rstest]
    #[case::icons_works(
        "/assets/icons/TVM300/REP%20TGV.svg",
        "image/svg+xml",
        "icons/TVM300/REP TGV.svg"
    )]
    #[case::sprites_works(
        "/assets/sprites/TVM300/REP%20TGV.svg",
        "image/svg+xml",
        "sprites/TVM300/REP TGV.svg"
    )]
    #[case::font_works(
        "/assets/fonts/glyphs/IBMPlexSans/0-255.pbf",
        "application/octet-stream",
        "fonts/glyphs/IBMPlexSans/0-255.pbf"
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn assets_works(
        #[case] request_uri: &str,
        #[case] content_type: &str,
        #[case] expected_path: &str,
    ) {
        let app = test_app!().skip_authz().build();
        let response = app.get(request_uri).await;
        response.assert_status_ok();
        assert_eq!(content_type, response.content_type());
        let response = response.into_bytes();
        let expected = std::fs::read(app.config().dynamic_assets_path.join(expected_path)).unwrap();
        assert_eq!(response, expected);
    }

    #[rstest]
    #[case::icons_not_found("/assets/icons/TVM300/NOT_A_THING.svg")]
    #[case::sprites_not_found("/assets/sprites/TVM300/NOT_A_THING.svg")]
    #[case::fonts_not_found("/assets/fonts/glyphs/Comic%20Sans/0-255.pbf")]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn assets_not_found(#[case] path: &str) {
        let app = test_app!().skip_authz().build();
        app.get(path).await.assert_status_not_found();
    }
}
