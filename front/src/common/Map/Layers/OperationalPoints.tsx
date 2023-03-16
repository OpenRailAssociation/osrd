import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';

interface PlatformProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

export default function OperationalPoints(props: PlatformProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;
  const layerPoint: LayerProps = {
    type: 'circle',
    'source-layer': 'operational_points',
    paint: {
      'circle-stroke-color': '#82be00',
      'circle-stroke-width': 2,
      'circle-color': 'rgba(255, 255, 255, 0)',
      'circle-radius': 3,
    },
  };

  const layerName: LayerProps = {
    type: 'symbol',
    'source-layer': 'operational_points',
    minzoom: 9.5,
    layout: {
      'text-field': [
        'concat',
        ['get', 'extensions_identifier_name'],
        ' / ',
        ['get', 'extensions_sncf_trigram'],
        [
          'case',
          ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
          '',
          ['concat', '\n', ['get', 'extensions_sncf_ch_long_label']],
        ],
        // ['concat', '\n', ['get', 'uic']],
      ],
      'text-font': ['Roboto Condensed'],
      'text-size': 12,
      'text-anchor': 'left',
      'text-justify': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    paint: {
      'text-color': colors.op.text,
      'text-halo-width': 2,
      'text-halo-color': colors.op.halo,
      'text-halo-blur': 1,
    },
  };

  const layerNameShort: LayerProps = {
    type: 'symbol',
    'source-layer': 'operational_points',
    maxzoom: 9.5,
    minzoom: 7,
    layout: {
      'text-field': [
        'concat',
        ['get', 'extensions_sncf_trigram'],
        ' ',
        [
          'case',
          ['in', ['get', 'extensions_sncf_ch'], ['literal', ['BV', '00']]],
          '',
          ['get', 'extensions_sncf_ch'],
        ],
      ],
      'text-font': ['Roboto Condensed'],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.1],
      visibility: 'visible',
    },
    paint: {
      'text-color': colors.op.text,
      'text-halo-width': 2,
      'text-halo-color': colors.op.halo,
      'text-halo-blur': 1,
    },
  };

  if (layersSettings.operationalpoints) {
    return (
      <Source
        id={`osrd_operational_point_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/operational_points/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...layerPoint}
          id={`chartis/osrd_operational_point/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...layerNameShort}
          id={`chartis/osrd_operational_point_name_short/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...layerName}
          id={`chartis/osrd_operational_point_name/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
