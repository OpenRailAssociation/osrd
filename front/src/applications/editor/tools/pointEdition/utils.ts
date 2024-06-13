import { isEmpty } from 'lodash';

import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import { NULL_GEOMETRY } from 'types';

import type {
  BufferStopEntity,
  DetectorEntity,
  SignalingSystemForm,
  SignalEntity,
  SignalingSystem,
} from './types';

export function getNewSignal(point?: [number, number]): SignalEntity {
  return {
    type: 'Feature',
    objType: 'Signal',
    properties: {
      id: NEW_ENTITY_ID,
      extensions: {
        sncf: {
          side: 'CENTER',
        },
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
function getLogicalSignalSettings(signalingSystem: SignalingSystemForm) {
  const { settings, signaling_system } = signalingSystem;
  switch (signaling_system) {
    case 'TVM':
      return {
        is_430: settings?.is_430 || 'false',
      };
    case 'BAPR':
      return {
        Nf: settings?.Nf || 'false',
        distant: settings?.distant || 'false',
      };
    default:
      return {
        Nf: settings?.Nf || 'false',
      };
  }
}

export function formatSignalingSystem(logicalSignal: SignalingSystemForm): SignalingSystem {
  const next_signaling_systems = logicalSignal.next_signaling_systems.map(
    (nextSignalingSystem) => nextSignalingSystem || 'BAL'
  );

  const settings = getLogicalSignalSettings(logicalSignal);

  if (logicalSignal.signaling_system !== 'BAL') {
    return {
      signaling_system: logicalSignal.signaling_system,
      next_signaling_systems,
      settings,
      default_parameters: {},
      conditional_parameters: [],
    } as SignalingSystem;
  }

  const conditional_parameters = logicalSignal.conditional_parameters.map((conditionalParameter) =>
    isEmpty(conditionalParameter)
      ? { on_route: '', parameters: { jaune_cli: 'false' } }
      : conditionalParameter
  );

  return {
    signaling_system: 'BAL',
    next_signaling_systems,
    settings,
    default_parameters: { jaune_cli: logicalSignal.default_parameters?.jaune_cli || 'false' },
    conditional_parameters,
  } as SignalingSystem;
}
