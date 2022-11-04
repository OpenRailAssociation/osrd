import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';

interface CatenariesProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

export default function Catenaries(props: CatenariesProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const { infraID } = useSelector((state: RootState) => state.osrdconf);
  const { geomType, colors, layerOrder } = props;
  const catenariesParams: LayerProps = {
    type: 'line',
    'source-layer': 'catenaries',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'voltage'], 15000],
        colors.powerline.color15000V1623,
        ['==', ['get', 'voltage'], 3000],
        colors.powerline.color3000V,
        ['==', ['get', 'voltage'], 1500],
        colors.powerline.color1500V,
        ['==', ['get', 'voltage'], 850],
        colors.powerline.color850V,
        ['==', ['get', 'voltage'], 800],
        colors.powerline.color800V,
        ['==', ['get', 'voltage'], 750],
        colors.powerline.color750V,
        colors.powerline.color25000V,
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': 1,
      'line-dasharray': [0.1, 0.3],
    },
  };

  const catenariesTextParams: LayerProps = {
    type: 'symbol',
    'source-layer': 'catenaries',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Medium'],
      'symbol-placement': 'line-center',
      'text-field': '{voltage}V',
      'text-offset': [0, 1],
      'text-size': {
        stops: [
          [10, 9],
          [14, 10],
        ],
      },
      'text-justify': 'left',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-anchor': 'center',
      'text-pitch-alignment': 'auto',
      'text-rotation-alignment': 'auto',
    },
    paint: {
      'text-color': [
        'case',
        ['==', ['get', 'voltage'], 15000],
        colors.powerline.color15000V1623,
        ['==', ['get', 'voltage'], 3000],
        colors.powerline.color3000V,
        ['==', ['get', 'voltage'], 1500],
        colors.powerline.color1500V,
        ['==', ['get', 'voltage'], 850],
        colors.powerline.color850V,
        ['==', ['get', 'voltage'], 800],
        colors.powerline.color800V,
        ['==', ['get', 'voltage'], 750],
        colors.powerline.color750V,
        colors.powerline.color25000V,
      ],
    },
  };

  if (layersSettings.catenaries) {
    return (
      <Source
        id={`catenaries_${geomType}`}
        type="vector"
        url={`${MAP_URL}/layer/catenaries/mvt/${geomType}/?infra=${infraID}`}
      >
        <OrderedLayer
          {...catenariesParams}
          // beforeId={`chartis/tracks-${geomType}/main`}
          id={`chartis/catenaries/${geomType}`}
          layerOrder={layerOrder}
        />
        <OrderedLayer
          {...catenariesTextParams}
          // beforeId={`chartis/tracks-${geomType}/main`}
          id={`chartis/catenaries_names/${geomType}`}
          layerOrder={layerOrder}
        />
      </Source>
    );
  }
  return null;
}
