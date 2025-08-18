use std::collections::HashMap;

use tracing::debug;
use uuid::Uuid;

use super::Fix;
use super::new_ref_fix_create_pair;
use crate::generated_data::infra_error::InfraError;
use crate::generated_data::infra_error::InfraErrorType;
use crate::infra_cache::object_cache::TrackSectionCache;
use schemas::infra::BufferStop;
use schemas::infra::Endpoint;
use schemas::infra::InfraObject;
use schemas::primitives::Identifier;
use schemas::primitives::OSRDIdentified as _;
use schemas::primitives::OSRDObject as _;
use schemas::primitives::ObjectRef;

pub fn fix_track_section(
    track_section: &TrackSectionCache,
    errors: impl Iterator<Item = InfraError>,
) -> HashMap<ObjectRef, Fix> {
    errors
        .filter_map(|infra_error| match infra_error.get_sub_type() {
            InfraErrorType::MissingBufferStop { endpoint } => {
                let track_id = infra_error.get_id();
                let position = match endpoint {
                    Endpoint::Begin => 0.0,
                    Endpoint::End => track_section.length,
                };
                let buffer_stop = InfraObject::BufferStop {
                    railjson: (BufferStop {
                        id: Identifier::from(Uuid::new_v4()),
                        track: track_id.to_string().into(),
                        position,
                        ..Default::default()
                    }),
                };
                Some(new_ref_fix_create_pair(buffer_stop))
            }
            _ => {
                debug!("error not (yet) fixable for '{}'", infra_error.get_type());
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::ops::Deref;

    use super::*;
    use crate::infra_cache::ObjectCache;
    use crate::infra_cache::operation::CacheOperation;
    use crate::infra_cache::operation::Operation;
    use schemas::infra::TrackSection;

    #[test]
    fn missing_buffer_stop() {
        let track_section = TrackSection {
            id: Identifier::from("track_section_id"),
            length: 42.0,
            ..Default::default()
        };
        let errors = vec![InfraError::new_missing_buffer_stop(
            &track_section,
            Endpoint::End,
        )];
        let operations = fix_track_section(
            &TrackSectionCache::from(track_section.clone()),
            errors.into_iter(),
        );

        assert_eq!(operations.len(), 1);
        let (operation, cache_operation) = operations.into_values().next().unwrap();
        let Operation::Create(railjson) = operation else {
            panic!("expecting an `Operation::Create(_)`");
        };
        let railjson = railjson.deref().clone();
        let InfraObject::BufferStop {
            railjson: buffer_stop,
        } = railjson
        else {
            panic!("expecting a `InfraObject::BufferStop {{ .. }}`")
        };
        assert_eq!(buffer_stop.track, track_section.id);
        assert_eq!(buffer_stop.position, 42.0);

        let CacheOperation::Create(object_cache) = cache_operation else {
            panic!("expecting an `CacheOperation::Create(_)`");
        };
        let ObjectCache::BufferStop(buffer_stop_cache) = object_cache else {
            panic!("expecting a `ObjectCache::BufferStop(_)`");
        };
        assert_eq!(buffer_stop_cache.obj_id, buffer_stop.id.as_str());
        assert_eq!(buffer_stop_cache.track, track_section.id.as_str());
        assert_eq!(buffer_stop_cache.position, 42.0);
    }
}
