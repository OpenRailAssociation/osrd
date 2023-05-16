import { IoMdAddCircleOutline } from 'react-icons/io';
import { SpeedSectionEntity, SpeedSectionLpvEntity } from 'types';
import getRangeEditionTool from './tool-factory';
import { getNewSpeedSection } from './utils';
import { SpeedSectionEditionLayers } from './components';

export const SpeedEditionTool = getRangeEditionTool<SpeedSectionEntity | SpeedSectionLpvEntity>({
  id: 'speed_sections',
  icon: IoMdAddCircleOutline,
  getNewEntity: getNewSpeedSection,
  layersComponent: SpeedSectionEditionLayers,
});
