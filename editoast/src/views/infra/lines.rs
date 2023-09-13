use crate::error::Result;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::Zone;
use crate::models::{Infra, Retrieve};
use crate::{routes, DbPool};
use actix_web::get;
use actix_web::web::{Data, Json, Path};
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use thiserror::Error;

routes! {
    "/lines" => {
        get_line_bbox
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra:lines")]
enum LinesErrors {
    #[error("no line with code {line_code} found")]
    LineNotFound { line_code: i32 },
}

/// Returns the bbox enclosing all the track sections of a train line
#[utoipa::path(
    params(super::InfraId),
    responses(
        (status = 200, description = "The bbox of the line", body = Vec<Zone>),
    ),
)]
#[get("/{line_code}/bbox")]
async fn get_line_bbox(
    path: Path<(i64, i64)>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    db_pool: Data<DbPool>,
) -> Result<Json<Zone>> {
    let (infra_id, line_code) = path.into_inner();
    let line_code: i32 = line_code.try_into().unwrap();
    let infra = Infra::retrieve(db_pool.clone(), infra_id).await?.unwrap();

    let conn = &mut db_pool.get().await?;
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
