use authz;
use authz::v2;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use itertools::Itertools;
use json_patch::AddOperation;
use json_patch::Patch;
use json_patch::PatchOperation;
use json_patch::RemoveOperation;
use json_patch::ReplaceOperation;
use schemas::infra::ApplicableDirectionsTrackRange;
use schemas::infra::DirectionalTrackRange;
use schemas::infra::Endpoint;
use schemas::infra::Sign;
use schemas::infra::Switch;
use schemas::infra::TrackEndpoint;
use schemas::infra::TrackOffset;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use schemas::primitives::OSRDIdentified;
use schemas::primitives::ObjectType;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tracing::info;
use uuid::Uuid;

use crate::AppState;
use crate::authentication;
use crate::error::Result;
use crate::generated_data;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::operation::DeleteOperation;
use crate::infra_cache::operation::Operation;
use crate::infra_cache::operation::UpdateOperation;
use crate::map;
use crate::views::AuthorizationError;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use database::DbConnection;
use models::Infra;
use models::prelude::*;
use schemas::infra::InfraObject;

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
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = Vec<Operation>,
    responses(
        (status = 200, body = Vec<InfraObject>, description = "The result of the operations")
    )
)]
pub(in crate::views) async fn edit(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool,
        infra_caches,
        valkey_client,
        config,
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(operations): Json<Vec<Operation>>,
) -> Result<Json<Vec<InfraObject>>> {
    // TODO: lock for update
    let mut infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(authz::Infra(infra_id), authz::InfraPrivilege::CanWrite)
        .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
        .await?;

    let mut infra_cache = InfraCache::get_or_load_mut(
        &mut db_pool.get().await?,
        &infra_caches,
        &infra,
        &valkey_client,
        config.app_version.as_deref(),
    )
    .await?;
    let operation_results = apply_edit(
        &mut db_pool.get().await?,
        &mut infra,
        &operations,
        &mut infra_cache,
        valkey_client.clone(),
        config.app_version.as_deref(),
    )
    .await?;

    let mut conn = valkey_client.get_connection().await?;
    map::invalidate_all(&mut conn, infra_id, config.app_version.as_deref()).await?;

    Ok(Json(operation_results))
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = TrackOffset,
    responses(
        (status = 200, body = inline(Vec<String>), description = "ID of the trackSections created")
    ),
)]
pub(in crate::views) async fn split_track_section(
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool,
        infra_caches,
        valkey_client,
        config,
        openfga,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(payload): Json<TrackOffset>,
) -> Result<Json<Vec<String>>> {
    info!(
        track_id = payload.track.as_str(),
        offset = payload.offset,
        "Splitting track section"
    );

    // Check the infra
    let mut infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    v2::infra_privilege_check(authz::Infra(infra_id), authz::InfraPrivilege::CanWrite)
        .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
        .await?;

    let mut infra_cache = InfraCache::get_or_load_mut(
        &mut db_pool.get().await?,
        &infra_caches,
        &infra,
        &valkey_client,
        config.app_version.as_deref(),
    )
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
            &mut db_pool.get().await?,
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
        &mut db_pool.get().await?,
        &mut infra,
        &operations,
        &mut infra_cache,
        valkey_client.clone(),
        config.app_version.as_deref(),
    )
    .await?;
    let mut conn = valkey_client.get_connection().await?;
    map::invalidate_all(&mut conn, infra_id, config.app_version.as_deref()).await?;

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
    let Some(objects) = impacted else {
        return vec![];
    };
    for obj in objects {
        match obj.obj_type {
            ObjectType::Signal => {
                let punctual_item = infra_cache.get_signal(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(punctual_item.position)
                            } else {
                                json!(punctual_item.position - distance)
                            },
                        }),
                    ]),
                }));
            }
            ObjectType::BufferStop => {
                let punctual_item = infra_cache.get_buffer_stop(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(punctual_item.position)
                            } else {
                                json!(punctual_item.position - distance)
                            },
                        }),
                    ]),
                }));
            }
            ObjectType::Detector => {
                let punctual_item = infra_cache.get_detector(&obj.obj_id).unwrap();
                operations.push(Operation::Update(UpdateOperation {
                    obj_type: obj.obj_type,
                    obj_id: obj.obj_id.to_string(),
                    railjson_patch: Patch(vec![
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/track".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(Identifier::from(left_tracksection_id))
                            } else {
                                json!(Identifier::from(right_tracksection_id))
                            },
                        }),
                        PatchOperation::Replace(ReplaceOperation {
                            path: "/position".to_string().parse().unwrap(),
                            value: if punctual_item.position <= distance {
                                json!(punctual_item.position)
                            } else {
                                json!(punctual_item.position - distance)
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
                            path: format!("/ports/{key}/track").parse().unwrap(),
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
                            format!("/extensions/psl_sncf/announcement/{index}"),
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
                            format!("/extensions/psl_sncf/r/{index}"),
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
                                path: format!("/parts/{index}/track").parse().unwrap(),
                                value: json!(Identifier::from(left_tracksection_id)),
                            }));
                        } else {
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{index}/track").parse().unwrap(),
                                value: json!(Identifier::from(right_tracksection_id)),
                            }));
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{index}/position").parse().unwrap(),
                                value: json!(part.position - distance),
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
                            format!("/extensions/neutral_sncf/announcement/{index}"),
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
                            format!("/extensions/neutral_sncf/end/{index}"),
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
                            format!("/extensions/neutral_sncf/rev/{index}"),
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
            ObjectType::LevelCrossing => {
                let level_crossing = infra_cache.get_level_crossing(&obj.obj_id).unwrap();
                let mut patch_operations: Vec<PatchOperation> = Vec::<PatchOperation>::new();
                for (index, part) in level_crossing.parts.iter().enumerate() {
                    if part.track == tracksection.id {
                        if part.position <= distance {
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{index}/track").parse().unwrap(),
                                value: json!(Identifier::from(left_tracksection_id)),
                            }));
                        } else {
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{index}/track").parse().unwrap(),
                                value: json!(Identifier::from(right_tracksection_id)),
                            }));
                            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                                path: format!("/parts/{index}/position").parse().unwrap(),
                                value: json!(part.position - distance),
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
                path: format!("{path}/track").parse().unwrap(),
                value: json!(Identifier::from(left_tracksection_id)),
            }));
        } else {
            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                path: format!("{path}/track").parse().unwrap(),
                value: json!(Identifier::from(right_tracksection_id)),
            }));
            patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                path: format!("{path}/position").parse().unwrap(),
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
                    path: format!("{path}/{index}/track").parse().unwrap(),
                    value: json!(Identifier::from(left_tracksection_id)),
                }));
            } else {
                // Case where the range is fully on right side
                // so we need to change the track and to subtract the distance on begin & end
                if range.begin >= distance {
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/track").parse().unwrap(),
                        value: json!(Identifier::from(right_tracksection_id)),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/begin").parse().unwrap(),
                        value: json!(range.begin - distance),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/end").parse().unwrap(),
                        value: json!(range.end - distance),
                    }));
                }
                // Case where the range is on left AND right side
                else {
                    patch_operations.push(PatchOperation::Remove(RemoveOperation {
                        path: format!("{path}/{index}").parse().unwrap(),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{path}/-").parse().unwrap(),
                        value: json!(ApplicableDirectionsTrackRange {
                            track: Identifier::from(left_tracksection_id),
                            end: distance,
                            ..range.clone()
                        }),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{path}/-").parse().unwrap(),
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
                    path: format!("{path}/{index}/track").parse().unwrap(),
                    value: json!(Identifier::from(left_tracksection_id)),
                }));
            } else {
                // Case where the range is fully on right side
                // so we need to change the track and to subtract the distance on begin & end
                if range.begin >= distance {
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/track").parse().unwrap(),
                        value: json!(Identifier::from(right_tracksection_id)),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/begin").parse().unwrap(),
                        value: json!(range.begin - distance),
                    }));
                    patch_operations.push(PatchOperation::Replace(ReplaceOperation {
                        path: format!("{path}/{index}/end").parse().unwrap(),
                        value: json!(range.end - distance),
                    }));
                }
                // Case where the range is on left AND right side
                else {
                    patch_operations.push(PatchOperation::Remove(RemoveOperation {
                        path: format!("{path}/{index}").parse().unwrap(),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{path}/-").parse().unwrap(),
                        value: json!(DirectionalTrackRange {
                            track: Identifier::from(left_tracksection_id),
                            end: distance,
                            ..range.clone()
                        }),
                    }));
                    patch_operations.push(PatchOperation::Add(AddOperation {
                        path: format!("{path}/-").parse().unwrap(),
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
    valkey_client: Arc<cache::Client>,
    app_version: Option<&str>,
) -> Result<Vec<InfraObject>> {
    let infra_id = infra.id;
    // Check if the infra is locked
    if infra.locked {
        return Err(EditionError::InfraIsLocked { infra_id }.into());
    }

    // Apply modifications in one transaction
    connection
        .clone()
        .transaction(|conn| {
            Box::pin(async move {
                let mut railjsons = vec![];
                let mut cache_operations = vec![];
                for operation in operations {
                    let railjson = operation.apply(infra_id, &mut conn.clone()).await?;
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
                infra.bump_version(&mut conn.clone()).await?;
                // Apply operations to infra cache
                infra_cache.apply_operations(&cache_operations)?;

                infra_cache.infra_version = infra.version;

                let mut valkey_conn = valkey_client.get_connection().await?;
                let _ = valkey_conn
                    .json_zadd(
                        InfraCache::get_patch_key(infra_id, app_version),
                        &cache_operations,
                        infra_cache.infra_version,
                    )
                    .await;

                // Refresh layers if needed
                generated_data::update_all(
                    &mut conn.clone(),
                    infra_id,
                    &cache_operations,
                    infra_cache,
                )
                .await
                .expect("Update generated data failed");

                // Bump infra generated version to the infra version
                infra.bump_generated_version(&mut conn.clone()).await?;

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

    #[error(
        "Invalid split offset for track section '{tracksection_id}' in infra '{infra_id}'. Expected a value between 0 and {tracksection_length} meters"
    )]
    #[editoast_error(status = 400)]
    SplitTrackSectionBadOffset {
        infra_id: i64,
        tracksection_id: String,
        tracksection_length: f64,
    },
}

#[cfg(test)]
pub mod tests {
    use authz::InfraGrant;
    use authz::Role;
    use authz::identity::User;
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::fixtures::create_small_infra;
    use crate::generated_data::infra_error::InfraError;
    use crate::generated_data::infra_error::InfraErrorType;
    use crate::views::infra::errors::query_errors;
    use crate::views::test_app;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestRequestExt as _;
    use models::infra::ObjectQueryable;

    async fn setup_split_track_test() -> (TestApp, Infra, User) {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let authorized_user = app
            .user("user", "User")
            .with_infra_grant(small_infra.id, InfraGrant::Writer)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.post(format!("/infra/refresh/?infras={}&force=true", small_infra.id).as_str())
            .by_user(authorized_user.as_ref())
            .await
            .assert_status_ok();

        (app, small_infra, authorized_user)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_should_return_404_with_bad_infra() {
        let app = test_app!().build();
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Make a call with a bad infra ID

        // Check that we receive a 404
        app.post("/infra/123456789/split_track_section/")
            .by_user(user.as_ref())
            .json(&json!({
                "track": String::from("INVALID-ID"),
                "offset": 1,
            }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn edition_endpoints_require_writer_grant_and_operational_studies() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user_missing_writer = app
            .user("alice", "Alice")
            .with_infra_grant(small_infra.id, InfraGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let user_missing_operational_studies = app
            .user("bob", "Bob")
            .with_infra_grant(small_infra.id, InfraGrant::Writer)
            .create()
            .await;

        app.post(format!("/infra/{}/", small_infra.id).as_str())
            .by_user(user_missing_writer.as_ref())
            .json(&Vec::<Operation>::new())
            .await
            .assert_status_forbidden();
        app.post(format!("/infra/{}/", small_infra.id).as_str())
            .by_user(user_missing_operational_studies.as_ref())
            .json(&Vec::<Operation>::new())
            .await
            .assert_status_forbidden();

        let split_payload = json!({
            "track": "TA0",
            "offset": 1,
        });
        app.post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user_missing_writer.as_ref())
            .json(&split_payload)
            .await
            .assert_status_forbidden();
        app.post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user_missing_operational_studies.as_ref())
            .json(&split_payload)
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_should_return_404_with_bad_id() {
        // Init
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(small_infra.id, InfraGrant::Writer)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Make a call with a bad ID

        // Check that we receive a 404
        app.post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track":"INVALID-ID",
                "offset": 1,
            }))
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_should_fail_with_bad_distance() {
        // Init
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(small_infra.id, InfraGrant::Writer)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Make a call with a bad distance

        // Check that we receive an error
        app.post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": "TA0",
                "offset": 5000000,
            }))
            .await
            .assert_status_bad_request();
    }

    #[rstest::rstest]
    #[case("TA0", 1000000)]
    #[case("TD1", 15500000)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_should_work(#[case] track: &str, #[case] offset: u64) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        // Get infra errors
        let (init_errors, _) = query_errors(&mut db_pool.get_ok(), &small_infra).await;

        // Make a call to split the track section
        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": track,
                "offset": offset,
            }))
            .await
            .assert_status_ok()
            .json();

        // Check the response
        assert_eq!(res.len(), 2);

        // Check that infra errors has not increased with the split (omit route error for now)
        let (errors, _) = query_errors(&mut db_pool.get_ok(), &small_infra).await;
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_edition_updates_modification_date() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let mut small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let mut infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();

        let old_modified = small_infra.modified;

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
        apply_edit(
            &mut db_pool.get_ok(),
            &mut small_infra,
            &operations,
            &mut infra_cache,
            app.valkey_client(),
            app.config().app_version.as_deref(),
        )
        .await
        .ok()
        .unwrap();

        assert!(small_infra.modified > old_modified);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn apply_edit_transaction_should_work() {
        // Init
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let conn = &mut db_pool.get().await.unwrap();

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
            conn,
            &mut small_infra,
            &operations,
            &mut infra_cache,
            app.valkey_client(),
            None,
        )
        .await
        .unwrap();

        // Check that the updated track has the new length
        assert_eq!(1234.0, result[0].get_data()["length"]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn apply_edit_transaction_should_rollback() {
        // Init
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let conn = &mut db_pool.get().await.unwrap();
        let mut small_infra = create_small_infra(conn).await;
        let mut infra_cache = InfraCache::load(conn, &small_infra).await.unwrap();

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
            conn,
            &mut small_infra,
            &operations,
            &mut infra_cache,
            app.valkey_client(),
            None,
        )
        .await;

        // Check that we have an error
        assert!(result.is_err());

        // Check that TA0 length is not changed
        let res: Vec<ObjectQueryable> = small_infra
            .get_objects(conn, ObjectType::TrackSection, &vec!["TA0".to_string()])
            .await
            .unwrap();
        assert_eq!(2000.0, res[0].railjson.as_object().unwrap()["length"]);
    }

    #[rstest::rstest]
    #[case(15_000_000, 14000.0, 0)] // op at 14000m on TD0, split at 15000m -> stays on left at 14000m
    #[case(10_000_000, 4000.0, 1)] // op at 14000m on TD0, split at 10000m -> goes to right at 4000m
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_with_operational_point(
        #[case] offset: u64,
        #[case] expected_position: f64,
        #[case] expected_track_index: usize, // 0 for left, 1 for right
    ) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": "TD0",
                "offset": offset,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(res.len(), 2);
        let expected_track_id = &res[expected_track_index];

        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let op = infra_cache
            .get_operational_point("Mid_East_station")
            .unwrap();
        let parts_on_track: Vec<_> = op
            .parts
            .iter()
            .filter(|p| p.track.as_str() == expected_track_id)
            .collect();

        assert_eq!(parts_on_track.len(), 1);
        assert_eq!(parts_on_track[0].position, expected_position);
    }

    #[rstest::rstest]
    #[case("DD0_5", 7887.5, 0)] // detector at 7887.5m on TD0, split at 15000m -> stays on left at 7887.5m
    #[case("DD0_10", 575.0, 1)] // detector at 15575m on TD0, split at 15000m -> goes to right at 575m
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_with_detectors(
        #[case] detector_id: &str,
        #[case] expected_position: f64,
        #[case] expected_track_index: usize, // 0 for left, 1 for right
    ) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": "TD0",
                "offset": 15_000_000,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(res.len(), 2);
        let expected_track_id = &res[expected_track_index];

        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let detector = infra_cache.get_detector(detector_id).unwrap();
        assert_eq!(detector.track.as_str(), expected_track_id);
        assert_eq!(detector.position, expected_position);
    }

    #[rstest::rstest]
    #[case("TH1", 2_000_000, "buffer_stop.7", 3000.0, 1)] // buffer stop at 5000m on TH1, split at 2000m -> goes to right at 3000m
    #[case("TA2", 1_000_000, "buffer_stop.2", 0.0, 0)] // buffer stop at 0m on TA2, split at 1000m -> stays on left at 0m
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_with_buffer_stops(
        #[case] track: &str,
        #[case] offset: u64,
        #[case] buffer_stop_id: &str,
        #[case] expected_position: f64,
        #[case] expected_track_index: usize, // 0 for left, 1 for right
    ) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": track,
                "offset": offset,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(res.len(), 2);
        let expected_track_id = &res[expected_track_index];

        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let buffer_stop = infra_cache.get_buffer_stop(buffer_stop_id).unwrap();
        assert_eq!(buffer_stop.track.as_str(), expected_track_id);
        assert_eq!(buffer_stop.position, expected_position);
    }

    #[rstest::rstest]
    #[case("SA6_1", 1780.0, 0)] // signal at 1780m on TA6, split at 2000m -> stays on left at 1780m
    #[case("SA6_2", 1380.0, 1)] // signal at 3380m on TA6, split at 2000m -> goes to right at 1380m
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_with_signals(
        #[case] signal_id: &str,
        #[case] expected_position: f64,
        #[case] expected_track_index: usize, // 0 for left, 1 for right
    ) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": "TA6",
                "offset": 2_000_000,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(res.len(), 2);
        let expected_track_id = &res[expected_track_index];

        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let signal = infra_cache.get_signal(signal_id).unwrap();
        assert_eq!(signal.track.as_str(), expected_track_id);
        assert_eq!(signal.position, expected_position);
    }

    #[rstest::rstest]
    #[case("TC0", 500_000, 125.0, 0)] // part at 125m on TC0, split at 500m -> stays on left at 125m
    #[case("TC1", 100_000, 20.0, 1)] // part at 120m on TC1, split at 100m -> goes to right at 20m
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn split_track_section_with_level_crossings(
        #[case] track: &str,
        #[case] offset: u64,
        #[case] expected_position: f64,
        #[case] expected_track_index: usize, // 0 for left, 1 for right
    ) {
        let (app, small_infra, user) = setup_split_track_test().await;
        let db_pool = app.db_pool();

        let res: Vec<String> = app
            .post(format!("/infra/{}/split_track_section", small_infra.id).as_str())
            .by_user(user.as_ref())
            .json(&json!({
                "track": track,
                "offset": offset,
            }))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(res.len(), 2);
        let expected_track_id = &res[expected_track_index];

        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();
        let lc = infra_cache.get_level_crossing("lc2").unwrap();
        let parts_on_track: Vec<_> = lc
            .parts
            .iter()
            .filter(|p| p.track.as_str() == expected_track_id)
            .collect();

        assert_eq!(parts_on_track.len(), 1);
        assert_eq!(parts_on_track[0].position, expected_position);
    }
}
