import {
  ALL_SIGNAL_LAYERS,
  DYNAMIC_LIGHTS_SIGNAL_LIST,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';
import {
  Layer,
  Source,
} from 'react-map-gl';
import { MAP_URL, SIGNALS_PANELS } from 'common/Map/const';
import React, { useEffect, useState } from 'react';

import PropTypes from 'prop-types';
import { feature } from '@turf/helpers';
import { useSelector } from 'react-redux';

const Signals = (props) => {
  const { mapStyle, signalsSettings, viewPort } = useSelector((state) => state.map);
  const timePosition = useSelector((state) => state.osrdsimulation.timePosition);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const allowanceSettings = useSelector((state) => state.osrdsimulation.allowanceSettings);
  const consolidatedSimulation = useSelector(
    (state) => state.osrdsimulation.consolidatedSimulation,
  );
  const [stopIds, setStopsIds] = useState([]);
  const [aIds, setAIds] = useState([]);
  const [vLIds, setVLIds] = useState([]);

  const { infraID } = useSelector((state) => state.osrdconf);
  const {
    colors, sourceTable, sourceLayer, hovered, mapRef,
  } = props;

  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = (sourceLayer === 'sch') ? 'SCH ' : '';
  }

  useEffect(() => {
    const map = mapRef?.current?.getMap();
    if (map) {
      // console.log('consolidatedSimulation', consolidatedSimulation[selectedTrain]);
      const selectedTrainConsolidatedSimulation = consolidatedSimulation[selectedTrain];

      console.log(LIGHT_SIGNALS.map((panel) => `chartis/signal/${sourceLayer}/${panel}`));

      const dynamicLayersIds = LIGHT_SIGNALS.map((panel) => `chartis/signal/${sourceLayer}/${panel}`).filter((dynamicLayerId) => map.getLayer(dynamicLayerId));

      const renderedDynamicStopsFeatures = map?.queryRenderedFeatures({ layers: dynamicLayersIds });

      console.log('All signal Aspects', selectedTrainConsolidatedSimulation.signalAspects);

      const stopIds = [];
      const aIds = [];
      const vLIds = [];

      renderedDynamicStopsFeatures.forEach((renderedDynamicStopsFeature) => {
        // find the info in simulation aspects
        const matchingSignalAspect = selectedTrainConsolidatedSimulation.signalAspects.find(
          (signalAspect) => signalAspect.signal_id === renderedDynamicStopsFeature.id && signalAspect.time_start < timePosition && signalAspect.time_end > timePosition,
        );

        console.log("All data on this feature", selectedTrainConsolidatedSimulation.signalAspects.filter(
          (signalAspect) => signalAspect.signal_id === renderedDynamicStopsFeature.id))

        //  && signalAspect.time_start < timePosition && signalAspect.time_end > timePosition,

        let passingState = 'STOP';
        if (matchingSignalAspect) {
          switch (matchingSignalAspect.color) {
            case 'rgba(255, 255, 0, 255)':
              passingState = 'A';
              if (aIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                aIds.push(matchingSignalAspect.signal_id);
              }
              break;
            case 'rgba(0, 255, 0, 255)':
              passingState = 'VL';
              if (vLIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                vLIds.push(matchingSignalAspect.signal_id);
              }
              break;
            case 'rgba(255, 0, 0, 255)':
              passingState = 'STOP';
              if (stopIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                stopIds.push(matchingSignalAspect.signal_id);
              }
              break;
            default:
              passingState = 'STOP';
              break;
          }
          map.setFeatureState({
            id: renderedDynamicStopsFeature.id,
            source: renderedDynamicStopsFeature.source,
            sourceLayer: renderedDynamicStopsFeature.sourceLayer,
          }, {
            passingState,
          });
        }
/*
        console.log('renderedFeature', renderedDynamicStopsFeature);
        console.log(timePosition);

        console.log('matchingSignalAspect', matchingSignalAspect);
        */
      });
      console.log('vLIds compute', vLIds);
      setStopsIds(stopIds);
      setAIds(aIds);
      setVLIds(vLIds);

      console.log(map?.queryRenderedFeatures({ layers: dynamicLayersIds }));
    }

    /*
    console.log(map?.queryRenderedFeatures({layers: PANELS_DYNAMIC_STOPS.map(panel => `chartis/signal/${sourceLayer}/${panel}`)})) */
  }, [timePosition, consolidatedSimulation, viewPort]);

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
        return ['concat', prefix, type, ' ', ['case',
          ['==', ['get', 'side'], 'RIGHT'], 'D',
          ['==', ['get', 'side'], 'LEFT'], 'G',
          '',
        ]];
      case 'CARRE':
      case 'S':
        return ['concat', prefix, type];
      case 'CARRE A':
      case 'S A':
        return ['concat', prefix, type];
      case 'CARRE VL':
      case 'S VL':
        return ['concat', prefix, type];
      default:
        return `${prefix}${type}`;
    }
  };

  const signalMat = () => {
    const angleName = (sourceLayer === 'sch') ? 'angle_sch' : 'angle_geo';

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
          ['==', ['get', 'side'], 'RIGHT'], 'MATD',
          ['==', ['get', 'side'], 'LEFT'], 'MATG',
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

  /**
   * Helpers function for factorization issue
   * @param {*} type
   * @param {*} angleName
   * @param {*} iconOffset
   * @param {*} textOffset
   * @param {*} minZoom
   * @param {*} isSignal
   * @param {*} size
   * @returns
   */
  const baseSignalLayout = (type, angleName, iconOffset, textOffset, minZoom, isSignal, size) => ({
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
      ['==', ['get', 'side'], 'RIGHT'], 'left',
      ['==', ['get', 'side'], 'LEFT'], 'right',
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
  });

  /**
   * Helper function for factorization issues
   * @param {*} colorsPaint
   * @returns
   */
  const baseSignalPaint = (colorsPaint) => ({
    'text-color': colorsPaint.signal.text,
    'text-halo-width': 10,
    'text-halo-color': colorsPaint.signal.halo,
    'text-halo-blur': 0,
  });

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
          ['==', ['get', 'side'], 'RIGHT'], ['literal', [1, -3]],
          ['==', ['get', 'side'], 'LEFT'], ['literal', [-1, -3]],
          ['literal', [0, 0]],
        ],
        'icon-offset': iconOffset,
        'icon-image': signalsTosprites(type),
        'icon-size': 0.5,
        'text-anchor': ['case',
          ['==', ['get', 'side'], 'RIGHT'], 'left',
          ['==', ['get', 'side'], 'LEFT'], 'right',
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
      paint: baseSignalPaint(colors),

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
        ['==', ['get', 'side'], 'RIGHT'], ['literal', [3.5, -3.5]],
        ['==', ['get', 'side'], 'LEFT'], ['literal', [-3.5, -3.5]],
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

  const signalA = (type, angleName, iconOffset, textOffset, minZoom, isSignal, size) => {
    const typeFilter = (type.split(' ')[0]);
    //console.log('compute with aIds', aIds);
    const filterA = ['in', 'id'].concat(aIds);

    return ({
      minzoom: 12,
      type: 'symbol',
      'source-layer': sourceTable,
      filter: ['all',
        ['==', 'installation_type', typeFilter],
        filterA,
      ],
      layout: baseSignalLayout(type, angleName, iconOffset, textOffset, minZoom, isSignal, size),
      paint: baseSignalPaint(colors),

    });
  };



  const signalVL = (type, angleName, iconOffset, textOffset, minZoom, isSignal, size) => {
    const typeFilter = (type.split(' ')[0]);
    //console.log('compute with vLIds', vLIds);

    const filterVL = ['in', 'id'].concat(vLIds);

    //console.log('compute with vLIds FILTER', filterVL);
    //console.log('compute with typeFiltere', typeFilter);

    return ({
      minzoom: 12,
      type: 'symbol',
      'source-layer': sourceTable,

      filter: ['all',
        ['==', 'installation_type', typeFilter],
        filterVL,
      ],

      layout: baseSignalLayout(type, angleName, iconOffset, textOffset, minZoom, isSignal, size),
      paint: baseSignalPaint(colors),

    });
  };

  const signal = (type) => {
    const angleName = (sourceLayer === 'sch') ? 'angle_sch' : 'angle_geo';

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
      ['==', ['get', 'side'], 'RIGHT'], ['literal', [textOffsetX, -0.3]],
      ['==', ['get', 'side'], 'LEFT'], ['literal', [(textOffsetX * -1), -0.3]],
      ['literal', [2, 0]],
    ];

    const iconOffset = ['case',
      ['==', ['get', 'side'], 'RIGHT'], ['literal', [iconOffsetX, offsetY]],
      ['==', ['get', 'side'], 'LEFT'], ['literal', [(iconOffsetX * -1), offsetY]],
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
      case 'CARRE A':
      case 'S A':
        return signalA(type, angleName, iconOffset, textOffset, minZoom, isSignal, size);
      case 'CARRE VL':
      case 'S VL':
        return signalVL(type, angleName, iconOffset, textOffset, minZoom, isSignal, size);
      default:
    }

    return ({
      minzoom: 12,
      type: 'symbol',
      'source-layer': sourceTable,
      filter: ['==', 'installation_type', type],
      layout: baseSignalLayout(type, angleName, iconOffset, textOffset, minZoom, isSignal, size),
      paint: baseSignalPaint(colors),

    });
  };

  const getLayerId = (sig) => {
    if (sig.split(' ')[0] === 'CARRE' || sig.split(' ')[0] === 'S') return sig.split(' ')[0];
    return sig;
  };

  return (
    <Source promoteId="id" type="vector" url={`${MAP_URL}/layer/${sourceTable}/mvt/${sourceLayer}/?infra=${infraID}`}>
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
  mapRef: PropTypes.object,
};

Signals.defaultProps = {
  hovered: null,
};

export default Signals;
