import {
  ALL_SIGNAL_LAYERS,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';
import { Layer, Source } from 'react-map-gl';
import React, { useEffect, useState } from 'react';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
} from './geoSignalsLayers';

import { MAP_URL } from 'common/Map/const';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

const Signals = (props) => {
  const { mapStyle, signalsSettings, viewPort } = useSelector((state) => state.map);
  const timePosition = useSelector((state) => state.osrdsimulation.timePosition);
  const selectedTrain = useSelector((state) => state.osrdsimulation.selectedTrain);
  const consolidatedSimulation = useSelector(
    (state) => state.osrdsimulation.consolidatedSimulation,
  );
  const { infraID } = useSelector((state) => state.osrdconf);
  const {
    colors, sourceTable, sourceLayer, hovered, mapRef,
  } = props;

  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = sourceLayer === 'sch' ? 'SCH ' : '';
  }

  const [redSignalIds, setRedSignalsIds] = useState([]);
  const [yellowSignalIds, setYellowSignalsIds] = useState([]);
  const [greenSignalsIds, setGreenSignalsIds] = useState([]);

  const map = mapRef?.current?.getMap(); // We need the mapBox map object

  const dynamicLayersIds = LIGHT_SIGNALS.map((panel) => `chartis/signal/${sourceLayer}/${panel}`).filter((dynamicLayerId) => map?.getLayer(dynamicLayerId)); // We need the layers concerned by eventual changes of signals

  /* EveryTime the viewPort change or the timePosition or the simulation change,
  visible signals are used to fill a list of special aspects (red, yellow).
   Default is green. Special Default are to be managed by beck office
   note: mapBox featureState is unfortunatly useless here for know so we setState
  */
  useEffect(() => {
    if (map) {
      const selectedTrainConsolidatedSimulation = consolidatedSimulation[selectedTrain];

      const renderedDynamicStopsFeatures = map.queryRenderedFeatures({ layers: dynamicLayersIds }); // can' be memoïzed :(

      const tmpRedIds = [];
      const tmpYellowIds = [];
      const tmpGreenIds = [];

      renderedDynamicStopsFeatures.forEach((renderedDynamicStopsFeature) => {
        // find the info in simulation aspects
        const matchingSignalAspect = selectedTrainConsolidatedSimulation.signalAspects.find(
          (signalAspect) => signalAspect.signal_id === renderedDynamicStopsFeature.id
          && signalAspect.time_start <= timePosition
          && signalAspect.time_end >= timePosition,
        );

        if (matchingSignalAspect) {
          switch (matchingSignalAspect.color) {
            case 'rgba(255, 255, 0, 255)':
              if (tmpYellowIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                tmpYellowIds.push(matchingSignalAspect.signal_id);
              }
              break;
            case 'rgba(0, 255, 0, 255)':
              if (tmpGreenIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                tmpGreenIds.push(matchingSignalAspect.signal_id);
              }
              break;
            case 'rgba(255, 0, 0, 255)':
              if (tmpRedIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                tmpRedIds.push(matchingSignalAspect.signal_id);
              }
              break;
            default:
              break;
          }
        }
      });

      setRedSignalsIds(tmpRedIds);
      setYellowSignalsIds(tmpYellowIds);
      setGreenSignalsIds(tmpRedIds);
    }
  }, [timePosition, consolidatedSimulation, viewPort, selectedTrain]);

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

  const signalsList = getSignalsList();
  const context = {
    prefix,
    colors,
    signalsList,
    sourceLayer,
    sourceTable,

  };

  const changeSignalsContext = {
    greenSignalsIds,
    yellowSignalIds,
    redSignalIds,
  };

  return (
    <Source
      promoteId="id"
      type="vector"
      url={`${MAP_URL}/layer/${sourceTable}/mvt/${sourceLayer}/?infra=${infraID}`}
    >
      <Layer {...getSignalMatLayerProps(context)} id="chartis/signal/mat" />
      <Layer {...getPointLayerProps(context)} id="chartis/signal/point" />

      {signalsList.map((sig) => {
        const layerId = `chartis/signal/${sourceLayer}/${sig}`;
        const isHovered = hovered && hovered.layer === layerId;
        const signalDef = getSignalLayerProps(context, sig, changeSignalsContext);
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
  mapRef: null,
};

export default Signals;
