import { CommonToolState } from '../types';
import { SpeedSectionEntity } from '../../../../types';

export type SpeedSectionEditionState = CommonToolState & {
  initialEntity: SpeedSectionEntity;
  entity: SpeedSectionEntity;

  interactionState:
    | { type: 'idle' }
    | { type: 'movedPoint'; track: string; extremity: 'BEGIN' | 'END' }
    | { type: 'addTrackSection' };
};
