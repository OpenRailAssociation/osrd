use crate::client::get_assets_path;
use crate::error::Result;
use crate::schema::sprite_config::SpriteConfig;
use actix_files::NamedFile;
use actix_web::get;
use actix_web::web::{Json, Path};
use editoast_derive::EditoastError;
use thiserror::Error;

crate::routes! {
    "/sprites" => {
        sprites,
        signaling_systems,
    },
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "sprites")]
enum SpriteErrors {
    #[error("Unknown signaling system '{0}'")]
    #[editoast_error(status = 404)]
    UnknownSignalingSystem(String),
    #[error("File '{0}' not found")]
    #[editoast_error(status = 404)]
    FileNotFound(String),
}

/// This endpoint returns the list of supported signaling systems
#[utoipa::path(
    tag = "sprites",
    responses(
        (status = 200, description = "List of supported signaling systems", body = Vec<String>, example = json!(["BAL", "TVM"])),
    ),
)]
#[get("/signaling_systems")]
async fn signaling_systems() -> Result<Json<Vec<String>>> {
    let sprite_configs = SpriteConfig::load();
    let signaling_systems = sprite_configs.keys().cloned().collect();
    Ok(Json(signaling_systems))
}

/// This endpoint is used by map libre to retrieve the atlas of each signaling system
#[utoipa::path(
    tag = "sprites",
    params(
        ("signaling_system" = String, Path, description = "Signaling system name"),
        ("file_name" = String, Path, description = "File name (json, png or svg)"),
    ),
    responses(
        (status = 200, description = "Atlas image of config"),
        (status = 404, description = "Signaling system not found"),
    ),
)]
#[get("/{signaling_system}/{file_name:[-_ @0-9A-Za-z]+\\.(json|png|svg)}")]
async fn sprites(path: Path<(String, String)>) -> Result<NamedFile> {
    let (signaling_system, file_name) = path.into_inner();
    let sprite_configs = SpriteConfig::load();
    if !sprite_configs.contains_key(&signaling_system) {
        return Err(SpriteErrors::UnknownSignalingSystem(signaling_system).into());
    }
    let path = get_assets_path().join(format!("signal_sprites/{signaling_system}/{file_name}"));
    if !path.is_file() {
        return Err(SpriteErrors::FileNotFound(file_name).into());
    }
    Ok(NamedFile::open(path).unwrap().use_last_modified(false))
}
