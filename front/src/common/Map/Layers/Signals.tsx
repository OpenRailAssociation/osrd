import React from 'react';
import { useSelector } from 'react-redux';
import { Source, MapRef } from 'react-map-gl/maplibre';
import { get } from 'lodash';

import { RootState } from 'reducers';
import { Theme } from 'types';

import { MAP_URL } from 'common/Map/const';
import {
  ALL_SIGNAL_LAYERS,
  LIGHT_SIGNALS,
  SIGNS_STOPS,
  SIGNS_TIVS,
} from 'common/Map/Consts/SignalsNames';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
} from './geoSignalsLayers';
import configKPLabelLayer from './configKPLabelLayer';

interface PlatformProps {
  colors: Theme;
  sourceTable: string;
  hovered?: { id: string; layer: string };
  mapRef?: React.RefObject<MapRef>;
  layerOrder: number;
}

function Signals(props: PlatformProps) {
  const { mapStyle, signalsSettings } = useSelector((state: RootState) => state.map);
  const infraID = useSelector(getInfraID);
  const { colors, sourceTable, hovered, layerOrder } = props;

  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';

  const getSignalsList = () => {
    let signalsList: Array<string> = [];
    if (signalsSettings.all) {
      return ALL_SIGNAL_LAYERS;
    }
    if (signalsSettings.stops) {
      signalsList = signalsList.concat(SIGNS_STOPS);
    }
    if (signalsSettings.tivs) {
      signalsList = signalsList.concat(SIGNS_TIVS);
    }
    if (signalsSettings.lights) {
      signalsList = signalsList.concat(LIGHT_SIGNALS);
    }
    return signalsList;
  };

  const signalsList = getSignalsList();

  const context: SignalContext = {
    prefix,
    colors,
    signalsList,
    sourceTable,
  };

  return (
    <Source
      promoteId="id"
      type="vector"
      url={`${MAP_URL}/layer/${sourceTable}/mvt/geo/?infra=${infraID}`}
    >
      <OrderedLayer
        {...getSignalMatLayerProps(context)}
        id="chartis/signal/mat"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...getPointLayerProps(context)}
        id="chartis/signal/point"
        layerOrder={layerOrder}
      />
      <OrderedLayer
        {...configKPLabelLayer({
          colors,
          fieldName: 'extensions_sncf_kp',
          minzoom: 12,
          isSignalisation: true,
          sourceLayer: sourceTable,
        })}
        id="chartis/signal/kp"
        filter={['in', 'extensions_sncf_installation_type', ...signalsList]}
        layerOrder={layerOrder}
      />

      {signalsList.map((sig) => {
        const layerId = `chartis/signal/geo/${sig}`;
        const isHovered = hovered && hovered.layer === layerId;
        const signalDef = getSignalLayerProps(context, sig);
        const opacity = get(signalDef.paint, 'icon-opacity', 1) as number;

        return (
          <OrderedLayer
            key={sig}
            {...signalDef}
            id={layerId}
            paint={{
              ...signalDef.paint,
              'icon-opacity': isHovered
                ? ['case', ['==', ['get', 'OP_id'], hovered.id], opacity * 0.6, opacity]
                : opacity,
            }}
            layerOrder={layerOrder}
          />
        );
      })}
    </Source>
  );
}

export default Signals;
