use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::Extension;
use diesel_async::AsyncConnection;
use editoast_authz::BuiltinRole;
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
use std::ops::DerefMut;
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
use crate::modelsv2::prelude::*;
use crate::modelsv2::Infra;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;
use editoast_models::DbConnection;
use editoast_schemas::infra::InfraObject;

crate::routes! {
    edit,
    "/split_track_section" => split_track_section,
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
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = Vec<Operation>,
    responses(
        (status = 200, body = Vec<InfraObject>, description = "The result of the operations")
    )
)]
async fn edit<'a>(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool_v2: db_pool,
        infra_caches,
        redis,
        map_layers,
        ..
    }): State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Json(operations): Json<Vec<Operation>>,
) -> Result<Json<Vec<InfraObject>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    // TODO: lock for update
    let mut infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let mut infra_cache =
        InfraCache::get_or_load_mut(db_pool.get().await?.deref_mut(), &infra_caches, &infra)
            .await?;
    let operation_results = apply_edit(
        db_pool.get().await?.deref_mut(),
        &mut infra,
        &operations,
        &mut infra_cache,
    )
    .await?;

    let mut conn = redis.get_connection().await?;
    map::invalidate_all(
        &mut conn,
        &map_layers.layers.keys().cloned().collect(),
        infra_id,
    )
    .await?;

    Ok(Json(operation_results))
}

#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = TrackOffset,
    responses(
        (status = 200, body = inline(Vec<String>), description = "ID of the trackSections created")
    ),
)]
pub async fn split_track_section<'a>(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool_v2: db_pool,
        infra_caches,
        redis,
        map_layers,
        ..
    }): State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Json(payload): Json<TrackOffset>,
) -> Result<Json<Vec<String>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    info!(
        track_id = payload.track.as_str(),
        offset = payload.offset,
        "Splitting track section"
    );

    // Check the infra
    let mut infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let mut infra_cache =
        InfraCache::get_or_load_mut(db_pool.get().await?.deref_mut(), &infra_caches, &infra)
            .await?;

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

    // Calling the DB to get the full object and also the split geo
    let result = infra
        .get_split_track_section_with_data(
            db_pool.get().await?.deref_mut(),
            payload.track.clone(),
            distance_fraction,
        )
        .await?;
    let tracksection_data = result.expect("Failed to retrieve split track section data. Ensure the track ID and distance fraction are valid.").clone();
    let tracksection = tracksection_data.railjson.as_ref().clone();

    // Building the two newly tracksections from the split one
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
                item.begin = (item.begin - distance).max(0.0);
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
                item.begin = (item.begin - distance).max(0.0);
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
                item.begin = (item.begin - distance).max(0.0);
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

    operations.extend(get_split_operations_for_impacted(
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
    apply_edit(
        db_pool.get().await?.deref_mut(),
        &mut infra,
        &operations,
        &mut infra_cache,
    )
    .await?;
    let mut conn = redis.get_connection().await?;
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
/// * `tracksection_id` - ID of the original track (the split one)
/// * `distance` - Distance (in meters) where the tracksection is split
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `sign` - Sign to check
fn get_split_operations_for_impacted(
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
                    railjson_patch: Patch(get_split_patch_operations_for_applicable_ranges(
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
                patch_operations.extend(get_split_patch_operations_for_applicable_ranges(
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
                    patch_operations.extend(get_split_patch_operations_for_sign(
                        tracksection.id.clone(),
                        distance,
                        left_tracksection_id,
                        right_tracksection_id,
                        "/extensions/psl_sncf/z".to_string(),
                        psl.z(),
                    ));
                    // check for `announcement`
                    for (index, sign) in psl.announcement().iter().enumerate() {
                        patch_operations.extend(get_split_patch_operations_for_sign(
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
                        patch_operations.extend(get_split_patch_operations_for_sign(
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
                patch_operations.extend(get_split_patch_operations_for_ranges(
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
                    patch_operations.extend(get_split_patch_operations_for_sign(
                        tracksection.id.clone(),
                        distance,
                        left_tracksection_id,
                        right_tracksection_id,
                        "/extensions/neutral_sncf/exe".to_string(),
                        &neutral.exe,
                    ));
                    // check for `announcement`
                    for (index, sign) in neutral.announcement.iter().enumerate() {
                        patch_operations.extend(get_split_patch_operations_for_sign(
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
                        patch_operations.extend(get_split_patch_operations_for_sign(
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
                        patch_operations.extend(get_split_patch_operations_for_sign(
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
/// * `tracksection_id` - ID of the original track (the split one)
/// * `distance` - Distance (in meters) where the tracksection is split
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `sign` - Sign to check
fn get_split_patch_operations_for_sign(
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
/// * `tracksection_id` - ID of the original track (the split one)
/// * `distance` - Distance (in meters) where the tracksection is split
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `right_tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `ranges` - List of track section ranges
fn get_split_patch_operations_for_applicable_ranges(
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
/// * `tracksection_id` - ID of the original track (the split one)
/// * `distance` - Distance (in meters) where the tracksection is split
/// * `left_tracksection_id` - ID of the newly "left" tracksection
/// * `right_tracksection_id` - ID of the newly "right" tracksection
/// * `path` - JSON path for the operation
/// * `ranges` - List of track section ranges
fn get_split_patch_operations_for_ranges(
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
        .transaction(|conn| {
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
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::generated_data::infra_error::InfraError;
    use crate::generated_data::infra_error::InfraErrorType;
    use crate::modelsv2::fixtures::create_small_infra;
    use crate::modelsv2::infra::ObjectQueryable;
    use crate::views::infra::errors::query_errors;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn split_track_section_should_return_404_with_bad_infra() {
        // Init
        let app = TestAppBuilder::default_app();

        // Make a call with a bad infra ID
        let request = app
            .post("/infra/123456789/split_track_section/")
            .json(&json!({
                "track": String::from("INVALID-ID"),
                "offset": 1,
            }));

        // Check that we receive a 404
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn split_track_section_should_return_404_with_bad_id() {
        // Init
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(db_pool.get_ok().deref_mut()).await;

        // Make a call with a bad ID
        let request = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .json(&json!({
                "track":"INVALID-ID",
                "offset": 1,
            }));

        // Check that we receive a 404
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn split_track_section_should_fail_with_bad_distance() {
        // Init
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(db_pool.get_ok().deref_mut()).await;

        // Make a call with a bad distance
        let request = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .json(&json!({
                "track": "TA0",
                "offset": 5000000,
            }));

        // Check that we receive an error
        app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    #[case("TA0", 1000000)]
    #[case("TD1", 15500000)]
    async fn split_track_section_should_work(#[case] track: &str, #[case] offset: u64) {
        // Init
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(db_pool.get_ok().deref_mut()).await;

        // Refresh the infra to get the good number of infra errors
        let req_refresh =
            app.post(format!("/infra/refresh/?infras={}&force=true", small_infra.id).as_str());
        app.fetch(req_refresh).assert_status(StatusCode::OK);

        // Get infra errors
        let (init_errors, _) = query_errors(db_pool.get_ok().deref_mut(), &small_infra).await;

        // Make a call to split the track section
        let request = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .json(&json!({
                "track": track,
                "offset": offset,
            }));
        let res: Vec<String> = app.fetch(request).assert_status(StatusCode::OK).json_into();

        // Check the response
        assert_eq!(res.len(), 2);

        // Check that infra errors has not increased with the split (omit route error for now)
        let (errors, _) = query_errors(db_pool.get_ok().deref_mut(), &small_infra).await;
        let errors_without_routes: Vec<InfraError> = errors
            .into_iter()
            .filter(|e| {
                !matches!(
                    e.sub_type,
                    InfraErrorType::MissingRoute | InfraErrorType::InvalidRoute
                )
            })
            .collect();
        assert_eq!(errors_without_routes.len() - init_errors.len(), 0);
    }

    #[rstest]
    async fn apply_edit_transaction_should_work() {
        // Init
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let mut small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let mut infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();

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
        let result: Vec<InfraObject> = apply_edit(
            &mut db_pool.get_ok(),
            &mut small_infra,
            &operations,
            &mut infra_cache,
        )
        .await
        .unwrap();

        // Check that the updated track has the new length
        assert_eq!(1234.0, result[0].get_data()["length"]);
    }

    #[rstest]
    async fn apply_edit_transaction_should_rollback() {
        // Init
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let mut small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let mut infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();

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
        let result = apply_edit(
            &mut db_pool.get_ok(),
            &mut small_infra,
            &operations,
            &mut infra_cache,
        )
        .await;

        // Check that we have an error
        assert!(result.is_err());

        // Check that TA0 length is not changed
        let res: Vec<ObjectQueryable> = small_infra
            .get_objects(
                &mut db_pool.get_ok(),
                ObjectType::TrackSection,
                &vec!["TA0".to_string()],
            )
            .await
            .unwrap();
        assert_eq!(2000.0, res[0].railjson.as_object().unwrap()["length"]);
    }
}
