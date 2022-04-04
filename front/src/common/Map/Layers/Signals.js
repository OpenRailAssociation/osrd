import {
  ALL_SIGNAL_LAYERS,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';
import {
  Layer,
  Source,
} from 'react-map-gl';
import { MAP_URL, SIGNALS_PANELS } from 'common/Map/const';

import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

const Signals = (props) => {
  const { mapStyle, signalsSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const {
    colors, sourceTable, sourceLayer, hovered,
  } = props;

  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = (sourceLayer === 'sch') ? 'SCH ' : '';
  }

  const getSignalsList = () => {
    let signalsList = [];
    if (signalsSettings.all) {
      return ALL_SIGNAL_LAYERS;
    }
    if (signalsSettings.stops) {
      signalsList = signalsList.concat(PANELS_STOPS);
    }
    if (signalsSettings.tivs) {
      signalsList = signalsList.concat(PANELS_TIVS);
    }
    if (signalsSettings.lights) {
      signalsList = signalsList.concat(LIGHT_SIGNALS);
    }
    return signalsList;
  };

  const signalList = getSignalsList();

  const point = () => ({
    type: 'circle',
    minzoom: 9,
    'source-layer': sourceTable,
    filter: ['in', ['get', 'installation_type'], ['literal', signalList]],
    paint: {
      'circle-color': colors.signal.point,
      'circle-radius': 3,
    },
  });

  const signalsTosprites = (type) => {
    switch (type) {
      case 'TIV D FIXE':
        return ['concat', prefix, 'TIV D FIXE ', ['get', 'value']];
      case 'TIV D MOB':
        return ['concat', prefix, 'TIV D MOB ', ['get', 'value']];
      case 'TIV R MOB':
        return ['concat', prefix, 'TIV R MOB ', ['get', 'value']];
      case 'TIVD C FIX':
        return ['concat', prefix, 'TIVD C FIX ', ['get', 'value']];
      case 'TIVD B FIX':
        return ['concat', prefix, 'TIVD B FIX ', ['get', 'value']];
      case 'TIV PENDIS':
        return ['concat', prefix, 'TIV PENDIS ', ['get', 'value']];
      case 'TIV PENEXE':
        return ['concat', prefix, 'TIV PENEXE ', ['get', 'value']];
      case 'CHEVRON':
        return `${prefix}CHEVRON BAS`;
      case 'ARRET VOY':
        return ['concat', prefix, 'ARRET VOY ', ['get', 'label']];
      case 'DIVERS':
        return ['case',
          ['==', ['get', 'value'], `${prefix}SIGNAUX A GAUCHE`], `${prefix}SIG A GAUCHE`,
          ['==', ['get', 'value'], `${prefix}SIGNAUX A DROITE`], `${prefix}SIG A DROITE`,
          '',
        ];
      case 'TECS':
      case 'TSCS':
        return ['concat', prefix, type, ' ', ['get', 'LP_positionLocalisation']];
      default:
        return `${prefix}${type}`;
    }
  };

  const signalMat = () => {
    const angleName = (sourceLayer === 'sch') ? 'angleSch' : 'angleGeo';

    return ({
      type: 'symbol',
      minzoom: 14,
      'source-layer': sourceTable,
      filter: ['in', ['get', 'installation_type'], ['literal', signalList]],
      layout: {
        'text-field': '', // '{installation_type} / {value} / {label}',
        'text-font': [
          'Roboto Condensed',
        ],
        'text-size': 9,
        'icon-image': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], 'MATD',
          ['==', ['get', 'LP_positionLocalisation'], 'G'], 'MATG',
          '',
        ],
        'icon-size': 0.7,
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-rotate': ['get', angleName],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
    });
  };

  const signalEmpty = (type, angleName, iconOffset, libelle = 'value') => {
    const excludeText = ['SIGNAUX A GAUCHE', 'SIGNAUX A DROITE'];

    return {
      type: 'symbol',
      minzoom: 13,
      'source-layer': sourceTable,
      filter: ['==', 'installation_type', type],
      layout: {
        'text-field': ['case',
          ['in', ['get', libelle], ['literal', excludeText]], '',
          ['get', libelle],
        ],
        'text-font': [
          'SNCF',
        ],
        'text-size': 8,
        'text-offset': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [1, -3]],
          ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [-1, -3]],
          ['literal', [0, 0]],
        ],
        'icon-offset': iconOffset,
        'icon-image': signalsTosprites(type),
        'icon-size': 0.5,
        'text-anchor': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], 'left',
          ['==', ['get', 'LP_positionLocalisation'], 'G'], 'right',
          'center',
        ],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'text-rotation-alignment': 'map',
        'icon-rotate': ['get', angleName],
        'text-rotate': ['get', angleName],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': colors.signal.text,
        'text-halo-width': 10,
        'text-halo-color': colors.signal.halo,
        'text-halo-blur': 0,
      },

    };
  };

  const signalPN = (angleName, iconOffset) => ({
    type: 'symbol',
    minzoom: 13,
    'source-layer': sourceTable,
    filter: ['==', 'installation_type', 'PN'],
    layout: {
      'text-field': '{label}',
      'text-font': [
        'SNCF',
      ],
      'text-size': 8,
      'text-offset': ['case',
        ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [3.5, -3.5]],
        ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [-3.5, -3.5]],
        ['literal', [0, 0]],
      ],
      'icon-offset': iconOffset,
      'icon-image': 'VIDEN2',
      'icon-size': 0.5,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'text-rotation-alignment': 'map',
      'icon-rotate': ['get', angleName],
      'text-rotate': ['get', angleName],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#fff',
    },
  });

  const signal = (type) => {
    const angleName = (sourceLayer === 'sch') ? 'angleSch' : 'angleGeo';

    let size = 0.4;
    let offsetY = -105;
    let iconOffsetX = 55;
    let textOffsetX = 3;
    let isSignal = true;
    if (SIGNALS_PANELS.indexOf(type) !== -1) {
      size = 0.4;
      iconOffsetX = 55;
      textOffsetX = 3;
      offsetY = -60;
      isSignal = false;
    } else if (prefix !== '') {
      size = 0.8;
      iconOffsetX = 30;
      offsetY = -80;
    }

    const minZoom = 14;

    const textOffset = ['case',
      ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [textOffsetX, -0.3]],
      ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [(textOffsetX * -1), -0.3]],
      ['literal', [2, 0]],
    ];

    const iconOffset = ['case',
      ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [iconOffsetX, offsetY]],
      ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [(iconOffsetX * -1), offsetY]],
      ['literal', [0, 0]],
    ];

    switch (type) {
      case 'REPER VIT':
        return signalEmpty(type, angleName, iconOffset, 'label');
      case 'DESTI':
      case 'DIVERS':
        return signalEmpty(type, angleName, iconOffset);
      case 'PN':
        return signalPN(angleName, iconOffset);
      default:
    }

    return ({
      minzoom: 12,
      type: 'symbol',
      'source-layer': sourceTable,
      filter: ['==', 'installation_type', type],
      layout: {
        'text-field': ['step',
          ['zoom'], '',
          minZoom, ['case', isSignal, ['get', 'label'], ''],
        ],
        'text-font': [
          'Roboto Condensed',
        ],
        'text-size': 9,
        'text-offset': textOffset,
        'icon-offset': ['step', ['zoom'], ['literal', [0, 0]], minZoom, iconOffset],
        'icon-image': signalsTosprites(type),
        'icon-size': ['step',
          ['zoom'], (size / 2),
          minZoom, size,
        ],
        'text-anchor': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], 'left',
          ['==', ['get', 'LP_positionLocalisation'], 'G'], 'right',
          'center',
        ],
        'icon-anchor': 'center',
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'text-rotation-alignment': 'map',
        'icon-rotate': ['get', angleName],
        'text-rotate': ['get', angleName],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': colors.signal.text,
        'text-halo-width': 3,
        'text-halo-color': colors.signal.halo,
        'text-halo-blur': 0,
      },

    });
  };

  return (
    <Source type="vector" url={`${MAP_URL}/layer/${sourceTable}/mvt/${sourceLayer}/?infra=${infraID}`}>
      <Layer {...signalMat()} id="chartis/signal/mat" />
      <Layer {...point()} id="chartis/signal/point" />
      {signalList.map((sig) => {
        const layerId = `chartis/signal/${sourceLayer}/${sig}`;
        const isHovered = hovered && hovered.layer === layerId;
        const signalDef = signal(sig);
        const opacity = (signalDef.paint || {})['icon-opacity'] || 1;

        return (
          <Layer
            key={sig}
            {...signalDef}
            id={layerId}
            paint={{
              ...signalDef.paint,
              'icon-opacity': isHovered
                ? ['case', ['==', ['get', 'OP_id'], hovered.id], opacity * 0.6, opacity]
                : opacity,
            }}
          />
        );
      })}
    </Source>
  );
};

Signals.propTypes = {
  hovered: PropTypes.object,
  colors: PropTypes.object.isRequired,
  sourceTable: PropTypes.string.isRequired,
  sourceLayer: PropTypes.string.isRequired,
};

Signals.defaultProps = {
  hovered: null,
};

export default Signals;
