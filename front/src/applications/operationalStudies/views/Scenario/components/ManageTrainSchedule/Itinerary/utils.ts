import type {
  OperationalPoint,
  OperationalPointReference,
  PathItemLocation,
} from 'common/api/osrdEditoastApi';
import type { PathStepMetadata } from 'reducers/osrdconf/types';

export const isOpRefMetadata = (pathStepMetadata: PathStepMetadata | undefined) =>
  !!pathStepMetadata && !pathStepMetadata.isInvalid && pathStepMetadata.type === 'opRef';

export const computeOpRefMarkerName = (
  pathStepMetadata: Extract<PathStepMetadata, { isInvalid: false; type: 'opRef' }>
) =>
  `${pathStepMetadata.name}${pathStepMetadata.secondaryCode ? ` ${pathStepMetadata.secondaryCode}` : ''}${pathStepMetadata.trackName ? ` \u00B7 ${pathStepMetadata.trackName}` : ''}`;

export const computePathStepCoordinates = (pathStepMetadata: PathStepMetadata) => {
  if (pathStepMetadata.isInvalid) return [];
  if (pathStepMetadata.type === 'trackOffset') {
    return [pathStepMetadata.coordinates];
  }
  if (pathStepMetadata.secondaryCode && pathStepMetadata.trackName) {
    const foundPart = pathStepMetadata.parts.find(
      (part) => part.trackName === pathStepMetadata.trackName
    );
    // If the track name is unknown (not matching any part), fall back to all parts coordinates
    return foundPart ? [foundPart.coordinates] : pathStepMetadata.parts.map((p) => p.coordinates);
  }
  if (pathStepMetadata.secondaryCode) {
    return pathStepMetadata.parts.map((part) => part.coordinates);
  }
  // If the path step has no secondary code, don't display its marker on the map
  return [];
};

export const buildOpRef = (op: OperationalPoint): OperationalPointReference => {
  const ch = op.extensions?.sncf?.ch;
  const uic = op.extensions?.identifier?.uic;
  if (uic != null)
    return {
      type: 'uic',
      uic,
      secondary_code: ch,
    };
  const trigram = op.extensions?.sncf?.trigram;
  if (trigram)
    return {
      type: 'trigram',
      trigram,
      secondary_code: ch,
    };
  return {
    type: 'id',
    operational_point: op.id,
  };
};

export const buildOpDisplayName = (op: OperationalPoint): string => {
  const name = op.extensions?.identifier?.name ?? op.extensions?.sncf?.trigram ?? '';
  const ch = op.extensions?.sncf?.ch;
  return ch ? `${name} ${ch}` : name;
};

export const getOpKey = (location: PathItemLocation | null): string | null => {
  if (!location || location.type === 'track_offset') return null;
  const op = location.operational_point;
  if (op.type === 'trigram') return `${op.trigram} ${op.secondary_code}`;
  if (op.type === 'uic') return `${op.uic} ${op.secondary_code}`;
  if (op.type === 'id') return `${op.operational_point}`;
  return null;
};
