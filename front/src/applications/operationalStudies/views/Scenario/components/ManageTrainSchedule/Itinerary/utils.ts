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
  const validParts = pathStepMetadata.parts.filter((p) => p.type === 'valid');
  const validPartsCoordinates = validParts.map((part) => part.coordinates);
  if (pathStepMetadata.secondaryCode && pathStepMetadata.trackName) {
    const foundPartCoordinates = validParts.find(
      (part) => part.trackName === pathStepMetadata.trackName
    )?.coordinates;
    // If the track name is unknown (not matching any part), fall back to all valid parts coordinates
    return foundPartCoordinates ? [foundPartCoordinates] : validPartsCoordinates;
  }
  if (pathStepMetadata.secondaryCode) {
    return validPartsCoordinates;
  }
  // If the path step has no secondary code, don't display its marker on the map
  return [];
};

export const buildOpRef = (op: OperationalPoint): OperationalPointReference => ({
  type: 'domestic',
  main_code: op.main_code,
  country_code: op.country_code,
  secondary_code: op.secondary_code,
});

export const buildOpDisplayName = (op: OperationalPoint): string => {
  const name = op.name;
  const secondaryCode = op.secondary_code;
  return secondaryCode ? `${name} ${secondaryCode}` : name;
};

export const getOpKey = (location: PathItemLocation | null): string | null => {
  if (!location || location.type === 'track_offset') return null;
  const op = location.operational_point;
  if (op.type === 'domestic') return `${op.country_code} ${op.main_code} ${op.secondary_code}`;
  if (op.type === 'id') return `${op.operational_point}`;
  if (op.type === 'uic') return `${op.uic} ${op.secondary_code}`;
  return null;
};
