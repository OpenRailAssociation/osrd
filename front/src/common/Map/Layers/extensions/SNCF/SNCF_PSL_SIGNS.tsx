import React from 'react';
import { MAP_URL } from 'common/Map/const';
import { LayerProps, Source, SymbolLayer } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { OmitLayer } from 'types';
import { isNil } from 'lodash';
import { getMap } from 'reducers/map/selectors';
import OrderedLayer from '../../OrderedLayer';
import { LayerContext } from '../../types';

interface SNCF_PSL_SignsProps {
  layerOrder?: number;
}

export function getPSLSignsLayerProps({
  sourceTable,
  prefix,
}: Pick<LayerContext, 'sourceTable' | 'prefix'>): Omit<SymbolLayer, 'source'> {
  const res: Omit<SymbolLayer, 'source'> = {
    id: 'signParams',
    type: 'symbol',
    minzoom: 11,
    paint: {},
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', 'type'], 'TIV_D'],
        ['concat', prefix, 'TIV D FIXE ', ['get', 'value']],
        ['==', ['get', 'type'], 'R'],
        ['concat', prefix, 'R'],
        ['==', ['get', 'type'], 'Z'],
        ['concat', prefix, 'Z'],
        ['==', ['get', 'type'], 'TIV_B'],
        ['concat', prefix, 'TIVD B FIX ', ['get', 'value']],
        'none',
      ],
      'icon-size': ['step', ['zoom'], 0.3, 15, 0.4],
      'icon-offset': [
        'step',
        ['zoom'],
        ['literal', [1.5, 0]],
        13,
        [
          'case',
          ['==', ['get', 'side'], 'RIGHT'],
          ['literal', [55, -80]],
          ['==', ['get', 'side'], 'LEFT'],
          ['literal', [-55, -80]],
          ['literal', [0, 0]],
        ],
      ],
      'icon-rotation-alignment': 'map',
      'icon-rotate': ['get', 'angle_geo'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getPSLSignsMastLayerProps({
  sourceTable,
}: Pick<LayerContext, 'sourceTable'>): OmitLayer<SymbolLayer> {
  const res: OmitLayer<SymbolLayer> = {
    type: 'symbol',
    minzoom: 13,
    paint: {},
    layout: {
      'icon-image': [
        'case',
        ['==', ['get', 'side'], 'RIGHT'],
        'MATD',
        ['==', ['get', 'side'], 'LEFT'],
        'MATG',
        '',
      ],
      'icon-size': 0.7,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-rotate': ['get', 'angle_geo'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function SNCF_PSL_Signs(props: SNCF_PSL_SignsProps) {
  const infraID = useSelector(getInfraID);
  const { layerOrder } = props;

  const { mapStyle } = useSelector(getMap);
  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';

  const signsParams: LayerProps = getPSLSignsLayerProps({
    sourceTable: 'psl_signs',
    prefix,
  });

  const mastsParams: LayerProps = getPSLSignsMastLayerProps({
    sourceTable: 'psl_signs',
  });

  return (
    <Source
      id="osrd_sncf_psl_signs_geo"
      type="vector"
      url={`${MAP_URL}/layer/psl_signs/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer {...mastsParams} layerOrder={layerOrder} />
      <OrderedLayer {...signsParams} layerOrder={layerOrder} />
    </Source>
  );
}
