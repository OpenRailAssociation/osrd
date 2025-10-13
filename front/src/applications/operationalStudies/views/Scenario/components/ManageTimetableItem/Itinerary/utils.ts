import type { PathStepMetadata } from 'reducers/osrdconf/types';

export const isOpRefMetadata = (pathStepMetadata: PathStepMetadata | undefined) =>
  !!pathStepMetadata && !pathStepMetadata.isInvalid && pathStepMetadata.type === 'opRef';

export const computePathStepCoordinates = (pathStepMetadata: PathStepMetadata) => {
  if (pathStepMetadata.isInvalid) return [];
  if (pathStepMetadata.type === 'trackOffset') {
    return [pathStepMetadata.coordinates];
  }
  if (pathStepMetadata.secondaryCode && pathStepMetadata.trackName) {
    const locationMetadata = pathStepMetadata.locationsBySecondaryCode
      .get(pathStepMetadata.secondaryCode)
      ?.find((loc) => loc.trackName === pathStepMetadata.trackName);
    return locationMetadata ? [locationMetadata.coordinates] : [];
  }
  if (pathStepMetadata.secondaryCode) {
    const locationMetadata = pathStepMetadata.locationsBySecondaryCode.get(
      pathStepMetadata.secondaryCode
    );
    return (locationMetadata ?? []).map((loc) => loc.coordinates);
  }
  const allMetadata = Array.from(pathStepMetadata.locationsBySecondaryCode.values()).flat();
  return allMetadata.map((metadata) => metadata.coordinates);
};
