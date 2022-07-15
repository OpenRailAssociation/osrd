import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, Layer, LayerProps } from 'react-map-gl';

import { MAP_URL } from 'common/Map/const';
import { Theme } from '../../../types';

export function getDetectorsLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): LayerProps {
  const res: LayerProps = {
    type: 'circle',
    paint: {
      'circle-stroke-color': params.colors.detectors.circle,
      'circle-color': params.colors.detectors.circle,
      'circle-radius': 3,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

export function getDetectorsNameLayerProps(params: {
  colors: Theme;
  sourceTable?: string;
}): LayerProps {
  const res: LayerProps = {
    type: 'symbol',
    layout: {
      'text-field': ['slice', ['get', 'id'], 9],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    paint: {
      'text-color': params.colors.detectors.text,
      'text-halo-width': 1,
      'text-halo-color': params.colors.detectors.halo,
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

const Detectors: FC<{ colors: Theme; geomType: string }> = ({ geomType, colors }) => {
  const { infraID } = useSelector((state: { osrdconf: { infraID: string } }) => state.osrdconf);
  const { layersSettings } = useSelector(
    (s: { map: { layersSettings: { detectors?: boolean } } }) => s.map
  );

  const layerPoint = getDetectorsLayerProps({ colors, sourceTable: 'detectors' });
  const layerName = getDetectorsNameLayerProps({ colors, sourceTable: 'detectors' });

  return layersSettings.detectors ? (
    <Source
      id={`osrd_detectors_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/detectors/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer {...layerPoint} id={`chartis/osrd_detectors/${geomType}`} />
      <Layer {...layerName} id={`chartis/osrd_detectors_name/${geomType}`} />
    </Source>
  ) : null;
};

export default Detectors;
