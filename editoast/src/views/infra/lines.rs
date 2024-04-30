use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use editoast_schemas::primitives::Zone;

crate::routes! {
    "/lines/{line_code}/bbox" => {
        get_line_bbox,
    },
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:lines")]
enum LinesErrors {
    #[error("no line with code {line_code} found")]
    LineNotFound { line_code: i32 },
}

/// Returns the BBoxes (geo and schematic) of a line
#[utoipa::path(
    tag = "infra",
    params(
        InfraIdParam,
        ("line_code" = i64, Path, description = "A line code"),
    ),
    responses(
        (status = 200, body = Zone, description = "The BBox of the line"),
    )
)]
#[get("")]
async fn get_line_bbox(
    path: Path<(i64, i64)>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<Zone>> {
    let (infra_id, line_code) = path.into_inner();
    let line_code: i32 = line_code.try_into().unwrap();

    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let mut zone = Zone::default();
    let mut tracksections = infra_cache
        .track_sections()
        .values()
        .map(ObjectCache::unwrap_track_section)
        .filter(|track| track.line_code.map_or(false, |code| code == line_code))
        .peekable();
    if tracksections.peek().is_none() {
        return Err(LinesErrors::LineNotFound { line_code }.into());
    }
    tracksections.for_each(|track| {
        zone.union(&Zone {
            geo: track.bbox_geo.clone(),
            sch: track.bbox_sch.clone(),
        });
    });

    Ok(Json(zone))
}
