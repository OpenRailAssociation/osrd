import { CommonToolState } from '../types';

export type ZoneSelectionState = CommonToolState & {
  zoneState:
    | { type: 'rectangle'; topLeft: [number, number] | null }
    | { type: 'polygon'; points: [number, number][] };
};
