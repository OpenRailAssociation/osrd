import { MAP_URL } from 'common/Map/const';
import React from 'react';
import { LayerProps, Source } from 'react-map-gl';
import { useSelector } from 'react-redux';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { SourceLayer, SymbolLayer } from 'types';
import { isNil } from 'lodash';
import { getMap } from 'reducers/map/selectors';
import OrderedLayer from '../../OrderedLayer';
import { LayerContext } from '../../types';

interface SNCF_LPV_PanelsProps {
  geomType: SourceLayer;
  layerOrder?: number;
}

export function getLPVPanelsLayerProps({
  sourceTable,
  prefix,
  sourceLayer,
}: Pick<LayerContext, 'sourceTable' | 'prefix' | 'sourceLayer'>): SymbolLayer {
  const angleName = sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';
  const res: SymbolLayer = {
    id: 'panelParams',
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
      'icon-rotate': ['get', angleName],
      'icon-allow-overlap': true,
      'icon-ignore-placement': false,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export function getLPVPanelsMastLayerProps({
  sourceTable,
  sourceLayer,
}: Pick<LayerContext, 'sourceTable' | 'sourceLayer'>): Omit<SymbolLayer, 'id'> {
  const angleName = sourceLayer === 'sch' ? 'angle_sch' : 'angle_geo';

  const res: Omit<SymbolLayer, 'id'> = {
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
      'icon-rotate': ['get', angleName],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  };

  if (!isNil(sourceTable)) res['source-layer'] = sourceTable;

  return res;
}

export default function SNCF_LPV_Panels(props: SNCF_LPV_PanelsProps) {
  const infraID = useSelector(getInfraID);
  const { geomType, layerOrder } = props;

  const { mapStyle } = useSelector(getMap);
  let prefix: string;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = geomType === 'sch' ? 'SCH ' : '';
  }

  const panelsParams: LayerProps = getLPVPanelsLayerProps({
    sourceTable: 'lpv_panels',
    sourceLayer: geomType,
    prefix,
  });

  const mastsParams: LayerProps = getLPVPanelsMastLayerProps({
    sourceTable: 'lpv_panels',
    sourceLayer: geomType,
  });

  return (
    <Source
      id={`osrd_sncf_lpv_panels_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/lpv_panels/mvt/${geomType}/?infra=${infraID}`}
    >
      <OrderedLayer {...mastsParams} layerOrder={layerOrder} />
      <OrderedLayer {...panelsParams} layerOrder={layerOrder} />
    </Source>
  );
}
