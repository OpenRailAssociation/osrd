import { MdSpeed } from 'react-icons/md';
import { ElectrificationEntity, SpeedSectionEntity, SpeedSectionPslEntity } from 'types';
import { GiElectric } from 'react-icons/gi';
import getRangeEditionTool from './tool-factory';
import { getNewElectrification, getNewSpeedSection } from './utils';
import { RangeEditionLeftPanel } from './components';
import {
  SpeedSectionEditionLayers,
  SpeedSectionMessages,
} from './speedSection/SpeedSectionEditionLayers';
import { ElectrificationEditionLayers, ElectrificationMessages } from './electrification/ElectrificationEditionLayers';

export const SpeedEditionTool = getRangeEditionTool<SpeedSectionEntity | SpeedSectionPslEntity>({
  id: 'SpeedSection',
  icon: MdSpeed,
  getNewEntity: getNewSpeedSection,
  messagesComponent: SpeedSectionMessages,
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
});

export const ElectrificationEditionTool = getRangeEditionTool<ElectrificationEntity>({
  id: 'Electrification',
  icon: GiElectric,
  getNewEntity: getNewElectrification,
  messagesComponent: ElectrificationMessages,
  layersComponent: ElectrificationEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
});
