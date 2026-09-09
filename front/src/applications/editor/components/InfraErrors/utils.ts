import type { InfraError } from 'common/api/osrdEditoastApi';

/**
 * Map tiles properties are flat: `sub_type` is exposed as a set of `sub_type_*` tags.
 */
export default function getInfraErrorFromTileProperties(
  properties: Record<string, unknown>
): InfraError {
  const subType = Object.entries(properties).reduce<Record<string, unknown>>(
    (acc, [key, value]) =>
      key.startsWith('sub_type_') ? { ...acc, [key.slice('sub_type_'.length)]: value } : acc,
    {}
  );

  return { ...properties, sub_type: subType } as InfraError;
}
