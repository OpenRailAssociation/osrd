import { defaultMapSettings } from 'reducers/commonMap';
import type { LayersSettings } from 'reducers/commonMap/types';

import type { Layer } from './consts';

export const getLayerSettingNameFromEditorLayer = (
  editorLayer: Layer
): keyof LayersSettings | null => {
  switch (editorLayer) {
    case 'psl':
    case 'psl_signs':
      return 'sncf_psl';
    case 'speed_sections':
      return 'speed_limits';
    case 'track_sections':
      return 'tvds';
    default:
      return editorLayer;
  }
};

export const getLayersSettingsFromEditorLayers = (
  editorLayers: Set<Layer> | undefined
): LayersSettings => {
  const layersSettings = {
    ...defaultMapSettings.layersSettings,
    operational_points: false,
    tvds: false,
  };
  editorLayers?.forEach((layer) => {
    const layerSetting = getLayerSettingNameFromEditorLayer(layer);
    if (layerSetting && layerSetting !== 'speedlimittag') {
      layersSettings[layerSetting] = true;
    }
  });
  return layersSettings;
};

export const getEditorLayersFromLayersSetting = (layersSettings: LayersSettings): Set<Layer> => {
  const layers: Layer[] = [];

  (
    [
      'buffer_stops',
      'electrifications',
      'detectors',
      'routes',
      'signals',
      'switches',
      'platforms',
      'neutral_sections',
      'operational_points',
      'errors',
    ] as const
  ).forEach((key) => {
    if (layersSettings[key]) layers.push(key);
  });

  if (layersSettings.speed_limits) {
    layers.push('speed_sections');
  }
  if (layersSettings.tvds) {
    layers.push('track_sections');
  }
  if (layersSettings.sncf_psl) {
    layers.push('psl');
    layers.push('psl_signs');
  }

  return new Set(layers);
};
