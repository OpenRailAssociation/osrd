import { MdSpeed } from 'react-icons/md';
import { GiElectric } from 'react-icons/gi';

import type {
  ElectrificationEntity,
  SpeedSectionEntity,
  SpeedSectionPslEntity,
} from 'applications/editor/tools/rangeEdition/types';

import getRangeEditionTool from './tool-factory';
import { getNewElectrification, getNewSpeedSection } from './utils';
import { RangeEditionLeftPanel } from './components';
import {
  SpeedSectionEditionLayers,
  SpeedSectionMessages,
} from './speedSection/SpeedSectionEditionLayers';
import {
  ElectrificationEditionLayers,
  ElectrificationMessages,
} from './electrification/ElectrificationEditionLayers';

export const SpeedEditionTool = getRangeEditionTool<SpeedSectionEntity | SpeedSectionPslEntity>({
  id: 'SpeedSection',
  icon: MdSpeed,
  getNewEntity: getNewSpeedSection,
  messagesComponent: SpeedSectionMessages,
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
  canSave(state) {
    const records = state.entity.properties.speed_limit_by_tag || {};
    return !state.error && Object.keys(records).every((code) => !!code);
  },
  getEventsLayers() {
    return [
      'editor/geo/track-main',
      'speed-section/extremities',
      'speed-section/track-sections',
      'speed-section/psl/extremities',
    ];
  },
});

export const ElectrificationEditionTool = getRangeEditionTool<ElectrificationEntity>({
  id: 'Electrification',
  icon: GiElectric,
  getNewEntity: getNewElectrification,
  messagesComponent: ElectrificationMessages,
  layersComponent: ElectrificationEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
  getEventsLayers() {
    return [
      'editor/geo/track-main',
      'electrification/extremities',
      'electrification/track-sections',
    ];
  },
});
