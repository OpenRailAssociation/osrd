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
#[editoast_error(base_id = "scenario")]
enum SpriteErrors {
    #[error("Unknown signaling system '{0}'")]
    #[editoast_error(status = 404)]
    UnknownSignalingSystem(String),
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
        ("file_name" = String, Path, description = "Atlas file name (json or png) respecting map libre documentation"),
    ),
    responses(
        (status = 200, description = "Atlas image of config"),
        (status = 404, description = "Signaling system not found"),
    ),
)]
#[get("/{signaling_system}/{file_name:sprites(@[23]x)?\\.(json|png)}")]
async fn sprites(path: Path<(String, String)>) -> Result<NamedFile> {
    let (signaling_system, file_name) = path.into_inner();
    let sprite_configs = SpriteConfig::load();
    if !sprite_configs.contains_key(&signaling_system) {
        return Err(SpriteErrors::UnknownSignalingSystem(signaling_system).into());
    }
    let path = get_assets_path().join(format!("signal_sprites/{signaling_system}/{file_name}"));
    assert!(path.is_file());
    Ok(NamedFile::open(path).unwrap().use_last_modified(false))
}
