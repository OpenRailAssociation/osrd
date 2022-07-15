import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Source, Layer, LayerProps } from 'react-map-gl';

import { MAP_URL } from 'common/Map/const';
import { Theme } from '../../../types';

export function getBufferStopsLayerProps(params: { sourceTable?: string }): LayerProps {
  const res: LayerProps = {
    type: 'symbol',
    minzoom: 12,
    layout: {
      'text-field': ['slice', ['get', 'id'], 11],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'viewport',
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-allow-overlap': false,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  if (typeof params.sourceTable === 'string') res['source-layer'] = params.sourceTable;
  return res;
}

const BufferStops: FC<{ colors: Theme; geomType: string }> = ({ geomType }) => {
  const { infraID } = useSelector((state: { osrdconf: { infraID: string } }) => state.osrdconf);
  const { layersSettings } = useSelector(
    (s: { map: { layersSettings: { bufferstops?: boolean } } }) => s.map
  );

  return layersSettings.bufferstops ? (
    <Source
      id={`osrd_bufferstoplayer_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/buffer_stops/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer
        {...getBufferStopsLayerProps({ sourceTable: 'buffer_stops' })}
        id={`chartis/osrd_bufferstoplayer/${geomType}`}
      />
    </Source>
  ) : null;
};

export default BufferStops;
