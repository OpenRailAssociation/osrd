import { CommonToolState } from '../types';
import { SwitchEntity, TrackEndpoint } from '../../../../types';

export type SwitchEditionState = CommonToolState & {
  initialEntity: Partial<SwitchEntity>;
  entity: Partial<SwitchEntity>;

  portState:
    | { type: 'idle' }
    | {
        type: 'selection';
        hoveredPoint: TrackEndpoint | null;
      };
};
