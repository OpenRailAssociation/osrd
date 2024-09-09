use editoast_derive::EditoastError;
use editoast_schemas::infra::RailJson;
use editoast_schemas::infra::RAILJSON_VERSION;

use crate::error::Result;
use crate::models::infra_objects::*;
use crate::models::prelude::*;
use editoast_models::DbConnection;

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "railjson")]
pub enum RailJsonError {
    #[error("Unsupported railjson version '{actual}'. Should be {expected}.")]
    UnsupportedVersion { actual: String, expected: String },
}

/// Inserts the content of a RailJson object into the database
///
/// All objects are attached to a given infra.
///
pub async fn persist_railjson(
    connection: &mut DbConnection,
    infra_id: i64,
    railjson: RailJson,
) -> Result<()> {
    let RailJson {
        version,
        track_sections,
        buffer_stops,
        electrifications,
        detectors,
        operational_points,
        routes,
        signals,
        switches,
        speed_sections,
        extended_switch_types,
        neutral_sections,
    } = railjson;

    if version != RAILJSON_VERSION {
        return Err(RailJsonError::UnsupportedVersion {
            actual: version,
            expected: RAILJSON_VERSION.to_string(),
        }
        .into());
    }

    connection
        .clone()
        .transaction(|conn| {
            Box::pin(async move {
                let _ = TrackSectionModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    TrackSectionModel::from_infra_schemas(infra_id, track_sections),
                )
                .await?;

                let _ = BufferStopModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    BufferStopModel::from_infra_schemas(infra_id, buffer_stops),
                )
                .await?;

                let _ = ElectrificationModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    ElectrificationModel::from_infra_schemas(infra_id, electrifications),
                )
                .await?;

                let _ = DetectorModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    DetectorModel::from_infra_schemas(infra_id, detectors),
                )
                .await?;

                let _ = OperationalPointModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    OperationalPointModel::from_infra_schemas(infra_id, operational_points),
                )
                .await?;

                let _ = RouteModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    RouteModel::from_infra_schemas(infra_id, routes),
                )
                .await?;

                let _ = SignalModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    SignalModel::from_infra_schemas(infra_id, signals),
                )
                .await?;

                let _ = SwitchModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    SwitchModel::from_infra_schemas(infra_id, switches),
                )
                .await?;

                let _ = SpeedSectionModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    SpeedSectionModel::from_infra_schemas(infra_id, speed_sections),
                )
                .await?;

                let _ = SwitchTypeModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    SwitchTypeModel::from_infra_schemas(infra_id, extended_switch_types),
                )
                .await?;

                let _ = NeutralSectionModel::create_batch::<_, Vec<_>>(
                    &mut conn.clone(),
                    NeutralSectionModel::from_infra_schemas(infra_id, neutral_sections),
                )
                .await?;

                Ok(())
            })
        })
        .await
}

pub async fn find_all_schemas<T, C>(conn: &mut DbConnection, infra_id: i64) -> Result<C>
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
