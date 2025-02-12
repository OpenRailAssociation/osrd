use axum::extract::Path;
use axum::extract::Request;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use thiserror::Error;
use tower::ServiceExt;
use tower_http::services::ServeFile;

use crate::client::get_dynamic_assets_path;
use crate::error::Result;

crate::routes! {
    "/fonts/{font}/{glyph}" => fonts,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "fonts")]
enum FontErrors {
    #[error("File '{file}' not found")]
    #[editoast_error(status = 404)]
    FileNotFound { file: String },
}

/// This endpoint is used by map libre to retrieve the fonts. They are separated by font and unicode block
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
async fn fonts(
    Path((font, file_name)): Path<(String, String)>,
    request: Request,
) -> Result<impl IntoResponse> {
    let path = get_dynamic_assets_path().join(format!("fonts/glyphs/{font}/{file_name}"));

    if !path.is_file() {
        return Err(FontErrors::FileNotFound { file: file_name }.into());
    }

    Ok(ServeFile::new(&path).oneshot(request).await)
}

#[cfg(test)]
mod tests {
    use crate::views::test_app::TestAppBuilder;

    use super::*;
    use axum::http::StatusCode;
    use rstest::rstest;

    #[rstest]
    async fn test_font() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/fonts/Roboto%20Bold/0-255.pbf");
        let response = app.fetch(request).assert_status(StatusCode::OK);
        assert_eq!("application/octet-stream", response.content_type());
        let response = response.bytes();
        let expected =
            std::fs::read(get_dynamic_assets_path().join("fonts/glyphs/Roboto Bold/0-255.pbf"))
                .unwrap();
        assert_eq!(response, expected);
    }

    #[rstest]
    async fn test_font_not_found() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/fonts/Comic%20Sans/0-255.pbf");
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }
}
