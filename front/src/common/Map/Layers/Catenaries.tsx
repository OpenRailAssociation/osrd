import React from 'react';
import { useSelector } from 'react-redux';
import { Source, LayerProps } from 'react-map-gl';

import { RootState } from 'reducers';
import { Theme } from 'types';
import { MAP_URL } from 'common/Map/const';
import { getInfraID } from 'reducers/osrdconf/selectors';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { isNil } from 'lodash';

interface CatenariesProps {
  colors: Theme;
  geomType: string;
  layerOrder: number;
}

export function getCatenariesProps({
  colors,
  sourceTable,
}: {
  colors: Theme;
  sourceTable?: string;
}) {
  const res: LayerProps = {
    type: 'line',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-join': 'miter',
    },
    paint: {
      'line-color': [
        'let',
        'voltageString',
        ['to-string', ['get', 'voltage']],
        [
          'case',
          ['==', ['var', 'voltageString'], '25000'],
          colors.powerline.color25000V,
          ['==', ['var', 'voltageString'], '15000'],
          colors.powerline.color15000V1623,
          ['==', ['var', 'voltageString'], '3000'],
          colors.powerline.color3000V,
          ['==', ['var', 'voltageString'], '1500'],
          colors.powerline.color1500V,
          ['==', ['var', 'voltageString'], '850'],
          colors.powerline.color850V,
          ['==', ['var', 'voltageString'], '800'],
          colors.powerline.color800V,
          ['==', ['var', 'voltageString'], '750'],
          colors.powerline.color750V,
          colors.powerline.colorOther,
        ],
      ],
      'line-width': 6,
      'line-offset': 0,
      'line-opacity': 1,
      'line-dasharray': [0.1, 0.3],
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getCatenariesTextParams({
  colors,
  sourceTable,
}: {
  colors: Theme;
  sourceTable?: string;
}) {
  const res: LayerProps = {
    type: 'symbol',
    minzoom: 5,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Medium'],
      'symbol-placement': 'line-center',
      'text-field': '{voltage}V',
      'text-offset': [0, -1],
      'text-size': {
        stops: [
          [10, 9],
          [14, 10],
        ],
      },
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-pitch-alignment': 'auto',
      'text-rotation-alignment': 'auto',
    },
    paint: {
      'text-color': [
        'let',
        'voltageString',
        ['to-string', ['get', 'voltage']],
        [
          'case',
          ['==', ['var', 'voltageString'], '25000'],
          colors.powerline.color25000V,
          ['==', ['var', 'voltageString'], '15000'],
          colors.powerline.color15000V1623,
          ['==', ['var', 'voltageString'], '3000'],
          colors.powerline.color3000V,
          ['==', ['var', 'voltageString'], '1500'],
          colors.powerline.color1500V,
          ['==', ['var', 'voltageString'], '850'],
          colors.powerline.color850V,
          ['==', ['var', 'voltageString'], '800'],
          colors.powerline.color800V,
          ['==', ['var', 'voltageString'], '750'],
          colors.powerline.color750V,
          colors.powerline.colorOther,
        ],
      ],
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function Catenaries(props: CatenariesProps) {
  const { layersSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, colors, layerOrder } = props;
  const catenariesParams: LayerProps = getCatenariesProps({ colors, sourceTable: 'catenaries' });
  const catenariesTextParams: LayerProps = getCatenariesTextParams({
    colors,
    sourceTable: 'catenaries',
  });

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
