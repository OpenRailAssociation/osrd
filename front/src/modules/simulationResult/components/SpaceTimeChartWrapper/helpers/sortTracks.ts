import type { Track } from '@osrd-project/ui-charts';

export const NO_TRACK_SPECIFIED_SYMBOL = '[ ]';

// Extracts the first integer (including negative) from a string, or null if none is found
export function extractFirstNumber(s: string): number | null {
  const match = s.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : null;
}

// Numeric-named tracks sort first (by the first number found in the name,
// then alphabetically), followed by named tracks without numbers,
// unnamed tracks, and finally '[ ]'.
export function compareTracksByName(a: Track, b: Track): number {
  const na = a.name != null ? extractFirstNumber(a.name) : null;
  const nb = b.name != null ? extractFirstNumber(b.name) : null;
  if (na !== null && nb !== null) return na - nb || a.name!.localeCompare(b.name!);
  if (na !== null) return -1;
  if (nb !== null) return 1;
  if (!a.name && !b.name) return 0;
  if (!a.name) return 1;
  if (!b.name) return -1;
  return a.name.localeCompare(b.name);
}

export function sortTracks(infraTracks: Track[], virtualTracks: Track[]): Track[] {
  const ncTrack = virtualTracks.find((t) => t.id === NO_TRACK_SPECIFIED_SYMBOL);
  const otherVirtual = virtualTracks
    .filter((t) => t.id !== NO_TRACK_SPECIFIED_SYMBOL)
    .sort(compareTracksByName);

  return [...infraTracks, ...otherVirtual, ...(ncTrack ? [ncTrack] : [])];
}
