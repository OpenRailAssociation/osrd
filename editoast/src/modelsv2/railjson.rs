use std::sync::Arc;

use editoast_derive::EditoastError;

use crate::{
    error::{InternalError, Result},
    modelsv2::{infra_objects::*, prelude::*},
    schema::{RailJson, RAILJSON_VERSION},
    DbPool,
};

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "railjson")]
pub enum RailJsonError {
    #[error("Unsupported railjson version '{0}'. Should be {}.", RAILJSON_VERSION)]
    UnsupportedVersion(String),
}

/// Inserts the content of a RailJson object into the database
///
/// All objects are attached to a given infra.
///
/// #### `/!\ ATTENTION /!\` On failure this function does NOT rollback the insertions!
pub async fn persist_railjson(
    db_pool: Arc<DbPool>,
    infra_id: i64,
    railjson: RailJson,
) -> Result<()> {
    macro_rules! persist {
        ($model:ident, $objects:expr) => {
            async {
                let conn = &mut db_pool.get().await.map_err(Into::<InternalError>::into)?;
                let _ = $model::create_batch::<_, Vec<_>>(
                    conn,
                    $model::from_infra_schemas(infra_id, $objects),
                )
                .await?;
                Ok(())
            }
        };
    }

    let RailJson {
        version,
        track_sections,
        buffer_stops,
        electrifications,
        detectors,
        operational_points,
        routes,
        signals,
        track_nodes,
        speed_sections,
        extended_track_node_types,
        neutral_sections,
    } = railjson;
    if version != RAILJSON_VERSION {
        return Err(RailJsonError::UnsupportedVersion(version).into());
    }
    futures::try_join!(
        persist!(TrackSectionModel, track_sections),
        persist!(BufferStopModel, buffer_stops),
        persist!(ElectrificationModel, electrifications),
        persist!(DetectorModel, detectors),
        persist!(OperationalPointModel, operational_points),
        persist!(RouteModel, routes),
        persist!(SignalModel, signals),
        persist!(TrackNodeModel, track_nodes),
        persist!(SpeedSectionModel, speed_sections),
        persist!(TrackNodeTypeModel, extended_track_node_types),
        persist!(NeutralSectionModel, neutral_sections),
    )
    .map(|_| ())
}

pub async fn find_all_schemas<T, C>(
    conn: &mut diesel_async::AsyncPgConnection,
    infra_id: i64,
) -> Result<C>
where
    T: ModelBackedSchema,
    C: FromIterator<T>,
{
    Ok(T::Model::find_all::<Vec<_>>(conn, infra_id)
        .await?
        .into_iter()
        .map(Into::into)
        .collect())
}
