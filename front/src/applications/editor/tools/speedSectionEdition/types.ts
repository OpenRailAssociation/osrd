import { CommonToolState } from '../types';
import { SpeedSectionEntity } from '../../../../types';

export type SpeedSectionEditionState = CommonToolState & {
  initialEntity: SpeedSectionEntity;
  entity: SpeedSectionEntity;
};
