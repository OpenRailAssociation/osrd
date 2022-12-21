import { CommonToolState } from '../types';
import { SwitchEntity, TrackEndpoint, TrackSectionEntity } from '../../../../types';

export type SwitchEditionState = CommonToolState & {
  initialEntity: Partial<SwitchEntity>;
  entity: Partial<SwitchEntity>;

  portEditionState:
    | { type: 'idle' }
    | {
        type: 'selection';
        portId: string;
        onSelect: (track: TrackSectionEntity, position: [number, number]) => void;
        hoveredPoint: TrackEndpoint | null;
      };
};
