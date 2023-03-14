import { MAP_URL } from 'common/Map/const';
import React from 'react';
import { LayerProps, Source } from 'react-map-gl';
import { useSelector } from 'react-redux';
import { RootState } from 'reducers';
import { getInfraID } from 'reducers/osrdconf/selectors';
import OrderedLayer from '../../OrderedLayer';

interface SNCF_LPV_PanelsProps {
  geomType: string;
  layerOrder?: number;
}

export default function SNCF_LPV_Panels(props: SNCF_LPV_PanelsProps) {
  const { mapStyle } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { geomType, layerOrder } = props;

  const angleName = geomType === 'sch' ? 'angle_sch' : 'angle_geo';
  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = geomType === 'sch' ? 'SCH ' : '';
  }

  const panelsParams: LayerProps = {
    id: 'panelParams',
    type: 'symbol',
    'source-layer': 'lpv_panels',
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

  const mastsParams: LayerProps = {
    type: 'symbol',
    'source-layer': 'lpv_panels',
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
