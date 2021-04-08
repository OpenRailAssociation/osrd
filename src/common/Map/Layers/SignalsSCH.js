import React from 'react';
import PropTypes from 'prop-types';
import { SIGNALS_PANELS, MAP_MODES } from 'common/Map/const';
import {
  Source, Layer,
} from 'react-map-gl';
import { ALL_SIGNAL_LAYERS } from 'common/Map/Consts/SignalsNames';
import { getSignalLayerId } from 'utils/helpers';
import Hover from 'common/Map/Hover';
import Selected from 'common/Map/Selected';

export default class SignalsSCH extends React.Component {
  static propTypes = {
    mapURL: PropTypes.string.isRequired,
    sourceLayer: PropTypes.string.isRequired,
    sourceTable: PropTypes.string.isRequired,
    mapMode: PropTypes.string,
    source: PropTypes.string,
    signalList: PropTypes.array,
  }

  static defaultProps = {
    source: 'gaia',
    signalList: ALL_SIGNAL_LAYERS,
    mapMode: MAP_MODES.display,
  }

  point = () => {
    const { sourceTable, signalList, mapMode } = this.props;

    const paint = {
      'circle-color': [
        'case',
        ['==', ['get', 'TIF_mnemo'], 'SG HEURT'], '#cd0037', // specific color for SG HEURT
        '#0088ce',
      ],
      'circle-radius': [
        'case',
        ['==', ['get', 'TIF_mnemo'], 'SG HEURT'], 4, // specific size for SG HEURT
        3,
      ],
    };
    if (mapMode === MAP_MODES.modification) {
      // specific color for verified signals
      paint['circle-color'].splice(1, 0, '#82be00');
      paint['circle-color'].splice(1, 0, ['==', ['get', 'isVerifie'], ['boolean', true]]);
      // specific size for verified signals
      paint['circle-radius'].splice(1, 0, 4);
      paint['circle-radius'].splice(1, 0, ['==', ['get', 'isVerifie'], ['boolean', true]]);
    }
    return {
      id: `${sourceTable}Layer`,
      type: 'circle',
      filter: ['in', ['get', 'TIF_mnemo'], ['literal', signalList]],
      minzoom: 9,
      'source-layer': sourceTable,
      paint,
    };
  };

  signalsTosprites = (type) => {
    switch (type) {
      case 'TIV D FIXE':
        return ['concat', 'SCH TIV D FIXE ', ['get', 'S_valeur']];
      case 'TIV D MOB':
        return ['concat', 'SCH TIV D MOB ', ['get', 'S_valeur']];
      case 'TIV R MOB':
        return ['concat', 'SCH TIV R MOB ', ['get', 'S_valeur']];
      case 'TIVD C FIX':
        return ['concat', 'SCH TIVD C FIX ', ['get', 'S_valeur']];
      case 'TIVD B FIX':
        return ['concat', 'SCH TIVD B FIX ', ['get', 'S_valeur']];
      case 'TIV PENDIS':
        return ['concat', 'SCH TIV PENDIS ', ['get', 'S_valeur']];
      case 'TIV PENEXE':
        return ['concat', 'SCH TIV PENEXE ', ['get', 'S_valeur']];
      case 'CHEVRON':
        return 'SCH CHEVRON BAS';
      case 'ARRET VOY':
        return ['concat', 'SCH ARRET VOY ', ['get', 'RA_libelle']];
      default:
        return `SCH ${type}`;
    }
  }

  signalMat = () => {
    const { sourceLayer, sourceTable, signalList } = this.props;

    const angleName = (sourceLayer === 'sch') ? 'angleSch' : 'angleGeo';

    return {
      type: 'symbol',
      minzoom: 14,
      'source-layer': sourceTable,
      filter: ['in', ['get', 'TIF_mnemo'], ['literal', signalList]],
      layout: {
        'text-field': '', // '{TIF_mnemo} / {S_valeur} / {RA_libelle}',
        'text-font': [
          'saxmono',
        ],
        'text-size': 9,
        'icon-image': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'G'], 'MATG',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], 'MATD',
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
    };
  }

  signalEmpty = (type, idLayer, angleName, iconOffset, prefix = '', suffix = '', libelle = 'S_valeur') => {
    const { sourceTable } = this.props;
    return {
      id: idLayer,
      type: 'symbol',
      minzoom: 13,
      'source-layer': sourceTable,
      filter: ['==', 'TIF_mnemo', type],
      layout: {
        'text-field': ['case',
          ['==', ['get', libelle], null], type,
          ['concat', prefix, ['get', libelle], suffix],
        ],
        'text-font': [
          'saxmono',
        ],
        'text-size': 9,
        'text-offset': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [1, -3]],
          ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [-1, -3]],
          ['literal', [0, 0]],
        ],
        'icon-offset': iconOffset,
        'icon-image': this.signalsTosprites(type),
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
        'text-color': '#333',
        /* 'text-halo-width': 10,
        'text-halo-color': 'rgba(255,255,255,1)',
        'text-halo-blur': 0, */
      },
    };
  }

  signalPN = (angleName, iconOffset) => {
    const { sourceTable } = this.props;
    return {
      id: 'signal_pn',
      type: 'symbol',
      minzoom: 13,
      'source-layer': sourceTable,
      filter: ['==', 'TIF_mnemo', 'PN'],
      layout: {
        'text-field': '{RA_libelle}',
        'text-font': [
          'saxmono',
        ],
        'text-size': 9,
        'text-offset': ['case',
          ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [2.5, -2.5]],
          ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [-2.5, -2.5]],
          ['literal', [0, 0]],
        ],
        'icon-offset': iconOffset,
        'icon-image': 'SCH VIDEN',
        'icon-size': 0.4,
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
        'text-color': '#000',
      },
    };
  }

  signal = (type) => {
    const { sourceLayer, sourceTable } = this.props;

    const angleName = (sourceLayer === 'sch') ? 'angleSch' : 'angleGeo';

    const idLayer = getSignalLayerId(type);

    let size = 0.8;
    let offsetY = -90;
    let iconOffsetX = 27;
    let textOffsetX = 3;
    let isSignal = true;
    if (SIGNALS_PANELS.indexOf(type) !== -1) {
      size = 0.4;
      iconOffsetX = 55;
      textOffsetX = 3;
      offsetY = -60;
      isSignal = (type === 'REP TGV');
    }

    const minZoom = 14;

    const textOffset = ['case',
      ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [textOffsetX, -0.3]],
      ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [(textOffsetX * -1), -0.3]],
      ['literal', [3, 0]],
    ];

    const iconOffset = ['case',
      ['==', ['get', 'LP_positionLocalisation'], 'D'], ['literal', [iconOffsetX, offsetY]],
      ['==', ['get', 'LP_positionLocalisation'], 'G'], ['literal', [(iconOffsetX * -1), offsetY]],
      ['literal', [0, -32]],
    ];

    // Override lot of signals are text-based
    switch (type) {
      case 'REPER VIT':
        return this.signalEmpty(type, idLayer, angleName, iconOffset, '', '', 'RA_libelle');
      case 'PN':
        return this.signalPN(angleName, iconOffset);
      case 'APPROETSA':
      case 'ARRET':
      case 'ARRETDESSERTE':
      case 'ARRETMAN':
      case 'ARRETREF':
      case 'ARRETTRAINS':
      case 'DESTI':
      case 'DIVERS':
      case 'GARE':
      case 'HEURT...':
      case 'PN...':
        return this.signalEmpty(type, idLayer, angleName, iconOffset);
      case 'ARRET A':
        return this.signalEmpty(type, idLayer, angleName, iconOffset, 'ARRÊT à ', 'm');
      case 'SECT':
        return this.signalEmpty(type, idLayer, angleName, iconOffset, 'SECT à ', 'm');
      default:
    }

    return {
      id: idLayer,
      minzoom: 11,
      type: 'symbol',
      'source-layer': sourceTable,
      filter: ['==', 'TIF_mnemo', type],
      layout: {
        'text-field': ['step',
          ['zoom'], '',
          minZoom, ['case', isSignal, ['get', 'RA_libelle'], ''],
        ],
        'text-font': [
          'saxmono',
        ],
        'text-size': 9,
        'text-offset': textOffset,
        'icon-offset': ['step', ['zoom'], ['literal', [0, 0]], minZoom, iconOffset],
        'icon-image': this.signalsTosprites(type),
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
        'text-color': '#555',
        'text-halo-width': 3,
        'text-halo-color': 'rgba(255,255,255,0.75)',
        'text-halo-blur': 0,
      },
    };
  }

  render() {
    const {
      mapURL, sourceLayer, sourceTable, source, signalList,
    } = this.props;

    return (
      <Source id={`${sourceTable}-${sourceLayer}-source`} type="vector" url={`${mapURL}/map/layer_def/${source}/${sourceTable}/${sourceLayer}/`}>
        <Layer {...this.signalMat()} />
        <Layer {...this.point()} />
        {
          signalList.map((sig) => (
            <Layer
              key={sig}
              {...this.signal(sig)}
            />
          ))
        }
        <Selected type="circle" sourceLayer={sourceTable} filterField="OP_id" />
        <Hover type="circle" sourceLayer={sourceTable} filterField="OP_id" />
      </Source>
    );
  }
}
