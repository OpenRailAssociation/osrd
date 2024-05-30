use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use editoast_schemas::infra::ApplicableDirectionsTrackRange;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::Sign;
use editoast_schemas::infra::Switch;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::ObjectType;
use itertools::Itertools;
use json_patch::{AddOperation, Patch, PatchOperation, RemoveOperation, ReplaceOperation};
use serde_json::json;
use std::collections::HashMap;
use thiserror::Error;
use tracing::error;
use tracing::info;
use uuid::Uuid;

use crate::error::Result;
use crate::generated_data;
use crate::infra_cache::object_cache::OperationalPointPartCache;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::operation::DeleteOperation;
use crate::infra_cache::operation::Operation;
use crate::infra_cache::operation::UpdateOperation;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::map;
use crate::map::MapLayers;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnection;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::RedisClient;
use editoast_schemas::infra::InfraObject;

crate::routes! {
    edit,
    split_track_section,
}

/// Edit the content of an infrastructure
///
/// Takes a batch of operations. An operation is a JSON patch document that will
/// be applied to the RailJSON description of the appropriate infra object.
///
/// The consistency of the patch with the RailJSON schema is checked. If a patch
/// is erroneous, the whole batch is rejected.
///
/// After editing the object, the generated cartographic layers are invalidated and
/// regenerated. The edition step fails if the regeneration fails.
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    request_body = Vec<Operation>,
    responses(
        (status = 200, body = Vec<InfraObject>, description = "The result of the operations")
    )
)]
#[post("")]
pub async fn edit<'a>(
    infra: Path<InfraIdParam>,
    operations: Json<Vec<Operation>>,
    db_pool: Data<DbConnectionPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    redis_client: Data<RedisClient>,
    map_layers: Data<MapLayers>,
) -> Result<Json<Vec<InfraObject>>> {
    let infra_id = infra.infra_id;

    let mut conn = db_pool.get().await?;
    // TODO: lock for update
    let mut infra =
        Infra::retrieve_or_fail(&mut conn, infra_id, || InfraApiError::NotFound { infra_id })
            .await?;
    let mut infra_cache = InfraCache::get_or_load_mut(&mut conn, &infra_caches, &infra).await?;
    let operation_results =
        apply_edit(&mut conn, &mut infra, &operations, &mut infra_cache).await?;

    let mut conn = redis_client.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
    )
    .await?;

    Ok(Json(operation_results))
}

#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    request_body = TrackOffset,
    responses(
        (status = 200, body = inline(Vec<String>), description = "ID of the trackSections created")
    ),
)]
#[post("/split_track_section")]
pub async fn split_track_section<'a>(
    infra: Path<i64>,
    payload: Json<TrackOffset>,
    db_pool: Data<DbConnectionPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    redis_client: Data<RedisClient>,
    map_layers: Data<MapLayers>,
) -> Result<Json<Vec<String>>> {
    let payload = payload.into_inner();
    let infra_id = infra.into_inner();
    info!(
        track_id = payload.track.as_str(),
        offset = payload.offset,
        "Splitting track section"
    );
    let conn = &mut db_pool.get().await?;

    // Check the infra
    let mut infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let mut infra_cache = InfraCache::get_or_load_mut(conn, &infra_caches, &infra).await?;

    // Get tracks cache if it exists
    let tracksection_cached = infra_cache.get_track_section(&payload.track)?.clone();

    // Check if the distance is compatible with the length of the TrackSection
    let distance = payload.offset as f64 / 1000.0;
    let distance_fraction = distance / tracksection_cached.length;
    if distance <= 0.0 || distance >= tracksection_cached.length {
        return Err(EditionError::SplitTrackSectionBadOffset {
            infra_id,
            tracksection_id: payload.track.to_string(),
            tracksection_length: tracksection_cached.length,
        }
        .into());
    }

    // Calling the DB to get the full object and also the splitted geo
    let result = infra
        .get_splited_track_section_with_data(conn, payload.track.clone(), distance_fraction)
        .await?;
    let tracksection_data = result.expect("Failed to retrieve splited track section data. Ensure the track ID and distance fraction are valid.").clone();
    let tracksection = tracksection_data.railjson.as_ref().clone();

    // Building the two newly tracksections from the splitted one
    // ~~~~~~~~~~~~~~~
    // left
    let left_tracksection_id = Uuid::new_v4();
    let left_tracksection = TrackSection {
        id: Identifier::from(left_tracksection_id),
        length: distance,
        geo: tracksection_data.left_geo.as_ref().clone(),
        slopes: tracksection
            .slopes
            .iter()
            .filter(|e| e.begin <= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.end > distance {
                    item.end = distance;
                }
                item
            })
            .collect_vec(),
        curves: tracksection
            .curves
            .iter()
            .filter(|e| e.begin <= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.end > distance {
                    item.end = distance;
                }
                item
            })
            .collect_vec(),
        loading_gauge_limits: tracksection
            .loading_gauge_limits
            .iter()
            .filter(|e| e.begin <= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.end > distance {
                    item.end = distance;
                }
                item
            })
            .collect_vec(),
        ..tracksection.clone()
    };

    // right
    let right_tracksection_id = Uuid::new_v4();
    let right_tracksection = TrackSection {
        id: Identifier::from(right_tracksection_id),
        length: tracksection.length - distance,
        geo: tracksection_data.right_geo.as_ref().clone(),
        slopes: tracksection
            .slopes
            .iter()
            .filter(|e| e.end >= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.begin < distance {
                    item.begin = distance;
                } else {
                    item.begin -= distance;
                }
                item.end -= distance;
                item
            })
            .collect_vec(),
        curves: tracksection
            .curves
            .iter()
            .filter(|e| e.end >= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.begin < distance {
                    item.begin = 0.0;
                } else {
                    item.begin -= distance;
                }
                item.end -= distance;
                item
            })
            .collect_vec(),
        loading_gauge_limits: tracksection
            .loading_gauge_limits
            .iter()
            .filter(|e| e.end >= distance)
            .map(|e| {
                let mut item = e.clone();
                if item.begin < distance {
                    item.begin = distance;
                } else {
                    item.begin -= distance;
                }
                item.end -= distance;
                item
            })
            .collect_vec(),
        ..tracksection.clone()
    };

    // track link
    let mut ports = HashMap::new();
    ports.insert(
        "A".into(),
        TrackEndpoint {
            track: Identifier::from(left_tracksection_id),
            endpoint: Endpoint::End,
        },
    );
    ports.insert(
        "B".into(),
        TrackEndpoint {
            track: Identifier::from(right_tracksection_id),
            endpoint: Endpoint::Begin,
        },
    );
    let track_link = Switch {
        id: Identifier::from(Uuid::new_v4()),
        switch_type: Identifier::from("link"),
        group_change_delay: 0.0,
        ports,
        ..Switch::default()
    };

    // Compute operations
    // ~~~~~~~~~~~~~~~~~~~~~~~
    // Firstly, we create the two newly tracks
    let mut operations: Vec<Operation> = [
        Operation::Create(Box::new(InfraObject::TrackSection {
            railjson: left_tracksection,
        })),
        Operation::Create(Box::new(InfraObject::TrackSection {
            railjson: right_tracksection,
        })),
        Operation::Create(Box::new(InfraObject::Switch {
            railjson: track_link,
        })),
    ]
    .to_vec();

    operations.extend(get_splitted_operations_for_impacted(
        &mut infra_cache,
        &tracksection,
        distance,
        left_tracksection_id,
        right_tracksection_id,
    ));

    // last operation, we delete the given track
    operations.push(Operation::Delete(DeleteOperation {
        obj_type: ObjectType::TrackSection,
        obj_id: payload.track.to_string(),
    }));

    // Apply operations
    apply_edit(conn, &mut infra, &operations, &mut infra_cache).await?;
    let mut conn = redis_client.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
    )
    .await?;

    // Return the result
    Ok(Json(
        [
            left_tracksection_id.to_string(),
            right_tracksection_id.to_string(),
        ]
        .to_vec(),
    ))
}

/// Function used while splitting a track section.
/// It compute the impacted list of operations in the DB to do, following the split of the tracksection.
///
/// # Example
/// * On Switch, we change the ports ref
/// * On electrification, we change the track ranges
/// * On Detector, BufferStop : we change the track and possibly its position
/// * ....
///
/// # Arguments
/// * `tracksection_id` - ID of the original track (the splitted one)
/// * `distance` - Distance (in meters) where the tracksection is splitted
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `sign` - Sign to check
fn get_splitted_operations_for_impacted(
    infra_cache: &mut InfraCache,
    tracksection: &TrackSection,
    distance: f64,
    left_tracksection_id: Uuid,
    right_tracksection_id: Uuid,
) -> Vec<Operation> {
    let mut operations: Vec<Operation> = Vec::<Operation>::new();
    let impacted = infra_cache.track_sections_refs.get(tracksection.get_id());
    let Some(objs) = impacted else {
        return vec![];
    };
    for obj in objs {
        match obj.obj_type {
            ObjectType::Signal => {
                let ponctual_item = infra_cache.get_signal(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(ponctual_item.position)
                            } else {
                                json!(ponctual_item.position - distance)
                            },
                        }),
                    ]),
                }));
            }
            ObjectType::BufferStop => {
                let ponctual_item = infra_cache.get_buffer_stop(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(ponctual_item.position)
                            } else {
                                json!(ponctual_item.position - distance)
                            },
                        }),
                    ]),
                }));
            }
            ObjectType::Detector => {
                let ponctual_item = infra_cache.get_detector(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if ponctual_item.position <= distance {
                                json!(ponctual_item.position)
                            } else {
                                json!(ponctual_item.position - distance)
                            },
                        }),
                    ]),
                }));
            }
            ObjectType::Switch => {
                let switch = infra_cache.get_switch(&obj.obj_id).unwrap();
                let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
                // Check ports ref
                for (key, value) in switch.ports.iter() {
                    if value.track == tracksection.id {
                        patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                            path: format!("/ports/{}/track", key).parse().unwrap(),
                            value: if value.endpoint == Endpoint::Begin {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }));
                    }
                }
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(patch_operations),
                }));
            }
            ObjectType::Electrification => {
                let electrification = infra_cache.get_electrification(&obj.obj_id).unwrap();
                // Check track ranges
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(get_splitted_patch_operations_for_applicable_ranges(
                        tracksection.id.clone(),
                        distance,
                        left_tracksection_id,
                        right_tracksection_id,
                        "/track_ranges".to_string(),
                        &electrification.track_ranges,
                    )),
                }));
            }
            ObjectType::SpeedSection => {
                let speedsection = infra_cache.get_speed_section(&obj.obj_id).unwrap();
                let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
                // Check track ranges
                patch_operations.extend(get_splitted_patch_operations_for_applicable_ranges(
                    tracksection.id.clone(),
                    distance,
                    left_tracksection_id,
                    right_tracksection_id,
                    "/track_ranges".to_string(),
                    &speedsection.track_ranges,
                ));
                // Check extensions for signs in extensions
                if let Some(psl) = &speedsection.extensions.psl_sncf {
                    // check for `z``
                    patch_operations.extend(get_splitted_patch_operations_for_sign(
                        tracksection.id.clone(),
                        distance,
                        left_tracksection_id,
                        right_tracksection_id,
                        "/extensions/psl_sncf/z".to_string(),
                        psl.z(),
                    ));
                    // check for `announcement`
                    for (index, sign) in psl.announcement().iter().enumerate() {
                        patch_operations.extend(get_splitted_patch_operations_for_sign(
                            tracksection.id.clone(),
                            distance,
                            left_tracksection_id,
                            right_tracksection_id,
                            format!("/extensions/psl_sncf/announcement/{}", index),
                            sign,
                        ));
                    }
                    // check for `r`
                    for (index, sign) in psl.r().iter().enumerate() {
                        patch_operations.extend(get_splitted_patch_operations_for_sign(
                            tracksection.id.clone(),
                            distance,
                            left_tracksection_id,
                            right_tracksection_id,
                            format!("/extensions/psl_sncf/r/{}", index),
                            sign,
                        ));
                    }
                }
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(patch_operations),
                }));
            }
            ObjectType::OperationalPoint => {
                let operationalpoint = infra_cache.get_operational_point(&obj.obj_id).unwrap();
                let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
                for (index, part) in operationalpoint.parts.iter().enumerate() {
                    if part.track == tracksection.id {
                        if part.position <= distance {
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{}/track", index).parse().unwrap(),
                                value: json!(Identifier::from(left_tracksection_id)),
                            }));
                        } else {
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{}", index).parse().unwrap(),
                                value: json!(OperationalPointPartCache {
                                    track: Identifier::from(right_tracksection_id),
                                    position: part.position - distance,
                                }),
                            }));
                        }
                    }
                }
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(patch_operations),
                }));
            }
            ObjectType::NeutralSection => {
                let neutralsection = infra_cache.get_neutral_section(&obj.obj_id).unwrap();
                let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
                // Check track ranges
                patch_operations.extend(get_splitted_patch_operations_for_ranges(
                    tracksection.id.clone(),
                    distance,
                    left_tracksection_id,
                    right_tracksection_id,
                    "/track_ranges".to_string(),
                    &neutralsection.track_ranges,
                ));
                // Check extensions for signs in extensions
                if let Some(neutral) = &neutralsection.extensions.neutral_sncf {
                    // Check for `z``
                    patch_operations.extend(get_splitted_patch_operations_for_sign(
                        tracksection.id.clone(),
                        distance,
                        left_tracksection_id,
                        right_tracksection_id,
                        "/extensions/neutral_sncf/exe".to_string(),
                        &neutral.exe,
                    ));
                    // check for `announcement`
                    for (index, sign) in neutral.announcement.iter().enumerate() {
                        patch_operations.extend(get_splitted_patch_operations_for_sign(
                            tracksection.id.clone(),
                            distance,
                            left_tracksection_id,
                            right_tracksection_id,
                            format!("/extensions/neutral_sncf/announcement/{}", index),
                            sign,
                        ));
                    }
                    // check for `end`
                    for (index, sign) in neutral.end.iter().enumerate() {
                        patch_operations.extend(get_splitted_patch_operations_for_sign(
                            tracksection.id.clone(),
                            distance,
                            left_tracksection_id,
                            right_tracksection_id,
                            format!("/extensions/neutral_sncf/end/{}", index),
                            sign,
                        ));
                    }
                    // check for `rev`
                    for (index, sign) in neutral.rev.iter().enumerate() {
                        patch_operations.extend(get_splitted_patch_operations_for_sign(
                            tracksection.id.clone(),
                            distance,
                            left_tracksection_id,
                            right_tracksection_id,
                            format!("/extensions/neutral_sncf/rev/{}", index),
                            sign,
                        ));
                    }
                }
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(patch_operations),
                }));
            }
            // TODO: route
            ObjectType::Route => (),
            // TrackSection doesn't depend on track
            ObjectType::TrackSection => (),
            // Switch type doesn't depend on track
            ObjectType::SwitchType => (),
        }
    }
    operations
}

/// Function used while splitting a track section.
/// It helps to generate a JSON patch operation for a `Sign`.
///
/// # Arguments
/// * `tracksection_id` - ID of the original track (the splitted one)
/// * `distance` - Distance (in meters) where the tracksection is splitted
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `sign` - Sign to check
fn get_splitted_patch_operations_for_sign(
    tracksection_id: Identifier,
    distance: f64,
    left_tracksection_id: Uuid,
    right_tracksection_id: Uuid,
    path: String,
    sign: &Sign,
) -> Vec<PatchOperation> {
    let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
    if sign.track == tracksection_id {
        if sign.position <= distance {
            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                path: format!("{}/track", path).parse().unwrap(),
                value: json!(Identifier::from(left_tracksection_id)),
            }));
        } else {
            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                path: format!("{}/track", path).parse().unwrap(),
                value: json!(Identifier::from(right_tracksection_id)),
            }));
            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                path: format!("{}/position", path).parse().unwrap(),
                value: json!(sign.position - distance),
            }));
        }
    }
    patch_operations
}

/// Function used while splitting a track section.
/// It helps to generate a JSON patch operation for a `Vec<ApplicableDirectionsTrackRange>`.
///
/// # Arguments
/// * `tracksection_id` - ID of the original track (the splitted one)
/// * `distance` - Distance (in meters) where the tracksection is splitted
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `right_tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `ranges` - List of track section ranges
fn get_splitted_patch_operations_for_applicable_ranges(
    tracksection_id: Identifier,
    distance: f64,
    left_tracksection_id: Uuid,
    right_tracksection_id: Uuid,
    path: String,
    ranges: &[ApplicableDirectionsTrackRange],
) -> Vec<PatchOperation> {
    let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
    for (index, range) in ranges.iter().enumerate() {
        if range.track == tracksection_id {
            // Case where the range is fully on left side
            // so we just need to change the track
            if range.end <= distance {
                patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                    path: format!("{}/{}/track", path, index).parse().unwrap(),
                    value: json!(Identifier::from(left_tracksection_id)),
                }));
            } else {
                // Case where the range is fully on right side
                // so we need to change the track and to substract the distance on begin & end
                if range.begin >= distance {
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/track", path, index).parse().unwrap(),
                        value: json!(Identifier::from(right_tracksection_id)),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/begin", path, index).parse().unwrap(),
                        value: json!(range.begin - distance),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/end", path, index).parse().unwrap(),
                        value: json!(range.end - distance),
                    }));
                }
                // Case where the range is on left AND right side
                else {
                    patch_operations.push(PatchOperation::Remove(RemoveOperation {
                        path: format!("{}/{}", path, index).parse().unwrap(),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{}/-", path).parse().unwrap(),
                        value: json!(ApplicableDirectionsTrackRange {
                            track: Identifier::from(left_tracksection_id),
                            end: distance,
                            ..range.clone()
                        }),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{}/-", path).parse().unwrap(),
                        value: json!(ApplicableDirectionsTrackRange {
                            track: Identifier::from(right_tracksection_id),
                            begin: 0.0,
                            end: range.end - distance,
                            ..range.clone()
                        }),
                    }));
                }
            }
        }
    }
    patch_operations
}

/// Function used while splitting a track section.
/// It helps to generate a JSON patch operation for a `Vec<DirectionalTrackRange>`.
/// /!\ It's the same function than the one above, but for `DirectionalTrackRange`` instead of `ApplicableDirectionsTrackRange``.
///
/// # Arguments
/// * `tracksection_id` - ID of the original track (the splitted one)
/// * `distance` - Distance (in meters) where the tracksection is splitted
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `right_tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `ranges` - List of track section ranges
fn get_splitted_patch_operations_for_ranges(
    tracksection_id: Identifier,
    distance: f64,
    left_tracksection_id: Uuid,
    right_tracksection_id: Uuid,
    path: String,
    ranges: &[DirectionalTrackRange],
) -> Vec<PatchOperation> {
    let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
    for (index, range) in ranges.iter().enumerate() {
        if range.track == tracksection_id {
            // Case where the range is fully on left side
            // so we just need to change the track
            if range.end <= distance {
                patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                    path: format!("{}/{}/track", path, index).parse().unwrap(),
                    value: json!(Identifier::from(left_tracksection_id)),
                }));
            } else {
                // Case where the range is fully on right side
                // so we need to change the track and to substract the distance on begin & end
                if range.begin >= distance {
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/track", path, index).parse().unwrap(),
                        value: json!(Identifier::from(right_tracksection_id)),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/begin", path, index).parse().unwrap(),
                        value: json!(range.begin - distance),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{}/{}/end", path, index).parse().unwrap(),
                        value: json!(range.end - distance),
                    }));
                }
                // Case where the range is on left AND right side
                else {
                    patch_operations.push(PatchOperation::Remove(RemoveOperation {
                        path: format!("{}/{}", path, index).parse().unwrap(),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{}/-", path).parse().unwrap(),
                        value: json!(DirectionalTrackRange {
                            track: Identifier::from(left_tracksection_id),
                            end: distance,
                            ..range.clone()
                        }),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{}/-", path).parse().unwrap(),
                        value: json!(DirectionalTrackRange {
                            track: Identifier::from(right_tracksection_id),
                            begin: 0.0,
                            end: range.end - distance,
                            ..range.clone()
                        }),
                    }));
                }
            }
        }
    }
    patch_operations
}

async fn apply_edit(
    connection: &mut DbConnection,
    infra: &mut Infra,
    operations: &[Operation],
    infra_cache: &mut InfraCache,
) -> Result<Vec<InfraObject>> {
    let infra_id = infra.id;
    // Check if the infra is locked
    if infra.locked {
        return Err(EditionError::InfraIsLocked { infra_id }.into());
    }

    // Apply modifications in one transaction
    connection
        .build_transaction()
        .run(|conn| {
            Box::pin(async {
                let mut railjsons = vec![];
                let mut cache_operations = vec![];
                for operation in operations {
                    let railjson = operation.apply(infra_id, conn).await?;
                    match (operation, railjson) {
                        (Operation::Create(_), Some(railjson)) => {
                            railjsons.push(railjson.clone());
                            cache_operations
                                .push(CacheOperation::Create(ObjectCache::from(railjson)));
                        }
                        (Operation::Update(_), Some(railjson)) => {
                            railjsons.push(railjson.clone());
                            cache_operations
                                .push(CacheOperation::Update(ObjectCache::from(railjson)));
                        }
                        (Operation::Delete(delete_operation), _) => {
                            cache_operations
                                .push(CacheOperation::Delete(delete_operation.clone().into()));
                        }
                        _ => unreachable!("CREATE and UPDATE always produce a RailJSON"),
                    }
                }

                // Bump version
                infra.bump_version(conn).await?;
                // Apply operations to infra cache
                infra_cache.apply_operations(&cache_operations)?;

                // Refresh layers if needed
                generated_data::update_all(conn, infra_id, &cache_operations, infra_cache)
                    .await
                    .expect("Update generated data failed");

                // Bump infra generated version to the infra version
                infra.bump_generated_version(conn).await?;

                Ok(railjsons)
            })
        })
        .await
}

#[derive(Debug, Clone, Error, EditoastError)]
#[editoast_error(base_id = "infra:edition")]
enum EditionError {
    #[error("Infra {infra_id} is locked")]
    InfraIsLocked { infra_id: i64 },

    #[error("Invalid split offset for track section '{tracksection_id}' in infra '{infra_id}'. Expected a value between 0 and {tracksection_length} meters")]
    #[editoast_error(status = 400)]
    SplitTrackSectionBadOffset {
        infra_id: i64,
        tracksection_id: String,
        tracksection_length: f64,
    },
}

#[cfg(test)]
pub mod tests {
    use actix_web::http::StatusCode;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::*;
    use serde_json::Value as JsonValue;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::small_infra;
    use crate::views::infra::errors::InfraError;
    use crate::views::pagination::PaginatedResponse;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn split_track_section_should_return_404_with_bad_infra() {
        // Init
        let app = create_test_service().await;

        // Make a call with a bad infra ID
        let req = TestRequest::post()
            .uri("/infra/123456789/split_track_section/")
            .set_json(json!({
                "track": String::from("INVALID-ID"),
                "offset": 1,
            }))
            .to_request();
        let res = call_service(&app, req).await;

        // Check that we receive a 404
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn split_track_section_should_return_404_with_bad_id() {
        // Init
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let app = create_test_service().await;

        // Make a call with a bad ID
        let req = TestRequest::post()
            .uri(format!("/infra/{}/split_track_section", small_infra.id()).as_str())
            .set_json(json!({
                "track":"INVALID-ID",
                "offset": 1,
            }))
            .to_request();
        let res = call_service(&app, req).await;

        // Check that we receive a 404
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn split_track_section_should_fail_with_bad_distance() {
        // Init
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let app = create_test_service().await;

        // Make a call with a bad distance
        let req = TestRequest::post()
            .uri(format!("/infra/{}/split_track_section", small_infra.id()).as_str())
            .set_json(json!({
                "track": "TA0",
                "offset": 5000000,
            }))
            .to_request();
        let res = call_service(&app, req).await;

        // Check that we receive an error
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn split_track_section_should_work() {
        // Init
        let pg_db_pool = db_pool();
        let small_infra = small_infra(pg_db_pool.clone()).await;
        let app = create_test_service().await;

        // Refresh the infra to get the good number of infra errors
        let req_refresh = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}&force=true", small_infra.id()).as_str())
            .to_request();
        call_service(&app, req_refresh).await;

        // Get infra errors
        let req_init_errors = TestRequest::get()
            .uri(format!("/infra/{}/errors", small_infra.id()).as_str())
            .to_request();
        let init_errors: PaginatedResponse<InfraError> =
            call_and_read_body_json(&app, req_init_errors).await;

        // Make a call to split the track section
        let req = TestRequest::post()
            .uri(format!("/infra/{}/split_track_section", small_infra.id()).as_str())
            .set_json(json!({
                "track": "TA0",
                "offset": 1000000,
            }))
            .to_request();
        let res: Vec<String> = call_and_read_body_json(&app, req).await;

        // Check the response
        assert_eq!(res.len(), 2);

        // Check that infra errors has not increased with the split (omit route error for now)
        let req_errors = TestRequest::get()
            .uri(format!("/infra/{}/errors", small_infra.id()).as_str())
            .to_request();
        let errors: PaginatedResponse<InfraError> = call_and_read_body_json(&app, req_errors).await;
        let errors_without_routes: Vec<InfraError> = errors
            .results
            .into_iter()
            .filter(|e| {
                !e.information["error_type"]
                    .as_str()
                    .unwrap()
                    .ends_with("_route")
            })
            .collect();
        assert_eq!(errors_without_routes.len() - init_errors.results.len(), 0);
    }

    #[rstest]
    async fn apply_edit_transaction_should_work() {
        // Init
        let pg_db_pool = db_pool();
        let conn = &mut pg_db_pool.get().await.unwrap();
        let mut small_infra = small_infra(pg_db_pool.clone()).await;
        let mut infra_cache = InfraCache::load(conn, &small_infra.model).await.unwrap();

        // Calling "apply_edit" with a OK operation
        let operations: Vec<Operation> = [
            // Success operation
            Operation::Update(UpdateOperation {
                obj_type: ObjectType::TrackSection,
                obj_id: "TA0".to_string(),
                railjson_patch: Patch(
                    [PatchOperation::Replace(ReplaceOperation {
                        path: "/length".to_string().parse().unwrap(),
                        value: json!(1234),
                    })]
                    .to_vec(),
                ),
            }),
        ]
        .to_vec();
        let result: Vec<InfraObject> =
            apply_edit(conn, &mut small_infra.model, &operations, &mut infra_cache)
                .await
                .unwrap();

        // Check that the updated track has the new length
        assert_eq!(1234.0, result[0].get_data()["length"]);
    }

    #[rstest]
    async fn apply_edit_transaction_should_rollback() {
        // Init
        let pg_db_pool = db_pool();
        let app = create_test_service().await;
        let conn = &mut pg_db_pool.get().await.unwrap();
        let mut small_infra = small_infra(pg_db_pool.clone()).await;
        let mut infra_cache = InfraCache::load(conn, &small_infra.model).await.unwrap();

        // Calling "apply_edit" with a first OK operation and a KO second one
        let operations: Vec<Operation> = [
            // Success operation
            Operation::Update(UpdateOperation {
                obj_type: ObjectType::TrackSection,
                obj_id: "TA0".to_string(),
                railjson_patch: Patch(
                    [PatchOperation::Replace(ReplaceOperation {
                        path: "/length".to_string().parse().unwrap(),
                        value: json!(1234),
                    })]
                    .to_vec(),
                ),
            }),
            // Bad operation
            Operation::Update(UpdateOperation {
                obj_type: ObjectType::TrackSection,
                obj_id: "ID_THAT_DOESNT-EXIST".to_string(),
                railjson_patch: Patch(
                    [PatchOperation::Replace(ReplaceOperation {
                        path: "/length".to_string().parse().unwrap(),
                        value: json!(1234),
                    })]
                    .to_vec(),
                ),
            }),
        ]
        .to_vec();
        let result = apply_edit(conn, &mut small_infra.model, &operations, &mut infra_cache).await;

        // Check that we have an error
        assert!(result.is_err());

        // Check that TA0 length is not changed
        let req = TestRequest::post()
            .uri(format!("/infra/{}/objects/TrackSection", small_infra.id()).as_str())
            .set_json(json!(["TA0"]))
            .to_request();
        let res: Vec<JsonValue> = call_and_read_body_json(&app, req).await;
        assert_eq!(2000.0, res[0]["railjson"]["length"])
    }
}
