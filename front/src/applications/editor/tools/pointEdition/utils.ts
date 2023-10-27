import {
  BufferStopEntity,
  DetectorEntity,
  NULL_GEOMETRY,
  SignalEntity,
  SignalingSystem,
} from '../../../../types';
import { NEW_ENTITY_ID } from '../../data/utils';

export function getNewSignal(point?: [number, number]): SignalEntity {
  return {
    type: 'Feature',
    objType: 'Signal',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        sncf: {},
      },
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}

export function getNewBufferStop(point?: [number, number]): BufferStopEntity {
  return {
    type: 'Feature',
    objType: 'BufferStop',
    properties: {
      id: NEW_ENTITY_ID,
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}

export function getNewDetector(point?: [number, number]): DetectorEntity {
  return {
    type: 'Feature',
    objType: 'Detector',
    properties: {
      id: NEW_ENTITY_ID,
    },
    geometry: point
      ? {
          type: 'Point',
          coordinates: point,
        }
      : NULL_GEOMETRY,
  };
}

/**
 * Given a signaling system, returns its default settings
 */
function getSignalDefaultSettings(signalingSystem?: 'BAL' | 'BAPR' | 'TVM' | undefined) {
  switch (signalingSystem) {
    case 'TVM':
      return {
        is_430: 'false',
      };
    case 'BAPR':
      return {
        Nf: 'false',
        distant: 'false',
      };
    default:
      return {
        Nf: 'false',
      };
  }
}

export function formatSignalingSystems(
  entity: SignalEntity
): SignalEntity['properties']['logical_signals'] {
  return entity.properties.logical_signals
    ? entity.properties.logical_signals.map((logicalSignal) => {
        const next_signaling_systems =
          logicalSignal && logicalSignal.next_signaling_systems
            ? logicalSignal.next_signaling_systems.map(
                (nextSignalingSystem) => nextSignalingSystem || 'BAL'
              )
            : [];
        const settings = {
          ...getSignalDefaultSettings(logicalSignal?.signaling_system),
          ...(logicalSignal?.settings || {}),
        };
        return {
          signaling_system: logicalSignal?.signaling_system || 'BAL',
          next_signaling_systems,
          settings,
        } as SignalingSystem;
      })
    : [];
}
