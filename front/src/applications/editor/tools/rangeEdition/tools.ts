import { GiElectric } from 'react-icons/gi';
import { MdSpeed } from 'react-icons/md';

import { RangeEditionLeftPanel } from './components';
import {
  ElectrificationEditionLayers,
  ElectrificationMessages,
} from './electrification/ElectrificationEditionLayers';
import {
  SpeedSectionEditionLayers,
  SpeedSectionMessages,
} from './speedSection/SpeedSectionEditionLayers';
import getRangeEditionTool from './tool-factory';
import type { ElectrificationEntity, SpeedSectionEntity, SpeedSectionPslEntity } from './types';
import { getNewElectrification, getNewSpeedSection } from './utils';

export const SpeedEditionTool = getRangeEditionTool<SpeedSectionEntity | SpeedSectionPslEntity>({
  id: 'SpeedSection',
  icon: MdSpeed,
  getNewEntity: getNewSpeedSection,
  messagesComponent: SpeedSectionMessages,
  requiredLayers: new Set(['speed_sections', 'psl', 'psl_signs', 'switches']),
  incompatibleLayers: ['electrifications'],
  layersComponent: SpeedSectionEditionLayers,
  leftPanelComponent: RangeEditionLeftPanel,
  canSave(state) {
    const records = state.entity.properties.speed_limit_by_tag || {};
    return !state.error && Object.keys(records).every((code) => !!code);
  },
  getEventsLayers() {
    return [
      'editor/geo/track-main',
      'editor/geo/switch-main',
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
  requiredLayers: new Set(['electrifications']),
  incompatibleLayers: ['speed_sections', 'psl', 'psl_signs', 'switches'],
  getEventsLayers() {
    return [
      'editor/geo/track-main',
      'electrification/extremities',
      'electrification/track-sections',
    ];
  },
});
