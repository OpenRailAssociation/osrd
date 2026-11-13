import type { TrackSectionSncfExtension } from 'common/api/osrdEditoastApi';

/**
 * The line and track identification of a track section, whichever infrastructure manager states it:
 * `sncf` first, then any other extension beside `source`, first by name.
 */
export function getTrackLine<T extends object = Partial<TrackSectionSncfExtension>>(
  extensions: Record<string, unknown> | null | undefined
): T | undefined {
  if (!extensions) return undefined;
  const others = Object.keys(extensions)
    .filter((name) => name !== 'sncf' && name !== 'source')
    .sort();
  return (
    ['sncf', ...others].map((name) => extensions[name] as T | null | undefined).find(Boolean) ??
    undefined
  );
}
