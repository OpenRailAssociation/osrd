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
#[editoast_error(base_id = "fonts")]
enum FontErrors {
    #[error("File '{file}' not found")]
    #[editoast_error(status = 404)]
    FileNotFound { file: String },
}

/// This endpoint is used by map libre to retrieve the fonts. They are separated by font and unicode block
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "fonts",
    params(
        ("font" = String, Path, description = "Requested font"),
        ("glyph" = String, Path, description = "Requested unicode block"),
    ),
    responses(
        (status = 200, description = "Glyphs in PBF format of the font at the requested unicode block"),
        (status = 404, description = "Font not found"),
    ),
)]
pub(in crate::views) async fn fonts(
    Path((font, file_name)): Path<(String, String)>,
    State(AppState { config, .. }): State<AppState>,
    request: Request,
) -> Result<impl IntoResponse> {
    let path = config
        .dynamic_assets_path
        .join(format!("fonts/glyphs/{font}/{file_name}"));

    if !path.is_file() {
        return Err(FontErrors::FileNotFound { file: file_name }.into());
    }

    Ok(ServeFile::new(&path).oneshot(request).await)
}

#[cfg(test)]
mod tests {
    use crate::views::test_app::TestAppBuilder;

    use axum::http::StatusCode;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_font() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/fonts/IBMPlexSans/0-255.pbf");
        let response = app.fetch(request).await.assert_status(StatusCode::OK);
        assert_eq!("application/octet-stream", response.content_type());
        let response = response.bytes();
        let expected = std::fs::read(
            app.config()
                .dynamic_assets_path
                .join("fonts/glyphs/IBMPlexSans/0-255.pbf"),
        )
        .unwrap();
        assert_eq!(response, expected);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_font_not_found() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/fonts/Comic%20Sans/0-255.pbf");
        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }
}
