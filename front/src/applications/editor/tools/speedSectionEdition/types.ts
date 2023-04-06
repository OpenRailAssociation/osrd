import { CommonToolState } from '../types';
import { SpeedSectionEntity } from '../../../../types';

export type SpeedSectionEditionState = CommonToolState & {
  initialEntity: Partial<SpeedSectionEntity>;
  entity: Partial<SpeedSectionEntity>;
};
