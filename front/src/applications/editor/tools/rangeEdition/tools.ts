import { IoMdAddCircleOutline } from 'react-icons/io';
import { CatenaryEntity, SpeedSectionEntity, SpeedSectionLpvEntity } from 'types';
import { GiElectric } from 'react-icons/gi';
import getRangeEditionTool from './tool-factory';
import { getNewCatenary, getNewSpeedSection } from './utils';
import { RangeEditionLeftPanel } from './components';
import {
  SpeedSectionEditionLayers,
  SpeedSectionMessages,
} from './speedSection/SpeedSectionEditionLayers';
import { CatenaryEditionLayers, CatenaryMessages } from './catenary/CatenaryEditionLayers';

export const SpeedEditionTool = getRangeEditionTool<SpeedSectionEntity | SpeedSectionLpvEntity>({
  id: 'SpeedSection',
  icon: IoMdAddCircleOutline,
  getNewEntity: getNewSpeedSection,
  messagesComponent: SpeedSectionMessages,
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
});

export const CatenaryEditionTool = getRangeEditionTool<CatenaryEntity>({
  id: 'Catenary',
  icon: GiElectric,
  getNewEntity: getNewCatenary,
  messagesComponent: CatenaryMessages,
  layersComponent: CatenaryEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
});
