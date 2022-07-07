import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';

import { MAP_URL } from 'common/Map/const';
import {
  ALL_SIGNAL_LAYERS,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
} from './geoSignalsLayers';

const Signals = (props) => {
  const { mapStyle, signalsSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { colors, sourceTable, sourceLayer, hovered } = props;

  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = sourceLayer === 'sch' ? 'SCH ' : '';
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
  const context = {
    prefix,
    colors,
    signalList,
    sourceLayer,
    sourceTable,
  };

  return (
    <Source
      type="vector"
      url={`${MAP_URL}/layer/${sourceTable}/mvt/${sourceLayer}/?infra=${infraID}`}
    >
      <Layer {...getSignalMatLayerProps(context)} id="chartis/signal/mat" />
      <Layer {...getPointLayerProps(context)} id="chartis/signal/point" />
      {signalList.map((sig) => {
        const layerId = `chartis/signal/${sourceLayer}/${sig}`;
        const isHovered = hovered && hovered.layer === layerId;
        const signalDef = getSignalLayerProps(context, sig);
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
