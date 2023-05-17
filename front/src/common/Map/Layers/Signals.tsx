import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Source, MapRef } from 'react-map-gl';
import { get, isNil } from 'lodash';

import { RootState } from 'reducers';
import { Theme, SourceLayer } from 'types';

import { MAP_URL } from 'common/Map/const';
import {
  ALL_SIGNAL_LAYERS,
  LIGHT_SIGNALS,
  PANELS_STOPS,
  PANELS_TIVS,
} from 'common/Map/Consts/SignalsNames';

import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { getInfraID } from 'reducers/osrdconf/selectors';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
} from './geoSignalsLayers';

interface PlatformProps {
  colors: Theme;
  sourceTable: string;
  sourceLayer: SourceLayer;
  hovered?: { id: string; layer: string };
  mapRef?: React.RefObject<MapRef>;
  layerOrder: number;
}

function Signals(props: PlatformProps) {
  const { mapStyle, signalsSettings, viewport } = useSelector((state: RootState) => state.map);
  const timePosition = useSelector((state: RootState) => state.osrdsimulation.timePosition);
  const selectedTrain = useSelector((state: RootState) => state.osrdsimulation.selectedTrain);
  const consolidatedSimulation = useSelector(
    (state: RootState) => state.osrdsimulation.consolidatedSimulation
  );
  const infraID = useSelector(getInfraID);
  const { colors, sourceTable, sourceLayer, hovered, mapRef, layerOrder } = props;

  let prefix;
  if (mapStyle === 'blueprint') {
    prefix = 'SCHB ';
  } else {
    prefix = sourceLayer === 'sch' ? 'SCH ' : '';
  }

  const [redSignalIds, setRedSignalsIds] = useState<string[]>([]);
  const [yellowSignalIds, setYellowSignalsIds] = useState<string[]>([]);
  const [greenSignalsIds, setGreenSignalsIds] = useState<string[]>([]);

  const dynamicLayersIds = LIGHT_SIGNALS.map(
    (panel) => `chartis/signal/${sourceLayer}/${panel}`
  ).filter((dynamicLayerId) => mapRef?.current?.getMap().getLayer(dynamicLayerId)); // We need the layers concerned by eventual changes of signals

  /* EveryTime the viewPort change or the timePosition or the simulation change,
  visible signals are used to fill a list of special aspects (red, yellow).
   Default is green. Special Default are to be managed by beck office
   note: mapBox featureState is unfortunatly useless here for know so we setState
  */
  useEffect(() => {
    if (mapRef && mapRef.current) {
      const selectedTrainConsolidatedSimulation = consolidatedSimulation[selectedTrain];

      const renderedDynamicStopsFeatures = mapRef.current.queryRenderedFeatures(
        mapRef.current.getBounds().toArray() as [[number, number], [number, number]],
        { layers: dynamicLayersIds }
      ); // can' be memoïzed :(

      const tmpRedIds: string[] = [];
      const tmpYellowIds: string[] = [];
      const tmpGreenIds: string[] = [];

      renderedDynamicStopsFeatures.forEach((renderedDynamicStopsFeature) => {
        // find the info in simulation aspects
        const matchingSignalAspect = selectedTrainConsolidatedSimulation.signalAspects.find(
          (signalAspect) =>
            signalAspect.signal_id === renderedDynamicStopsFeature.id &&
            !isNil(signalAspect.time_start) &&
            signalAspect.time_start <= new Date(timePosition as string) &&
            !isNil(signalAspect.time_end) &&
            signalAspect.time_end >= new Date(timePosition as string)
        );

        if (matchingSignalAspect) {
          switch (matchingSignalAspect.color) {
            case 'rgba(255, 0, 0, 255)':
              if (tmpRedIds.indexOf(matchingSignalAspect.signal_id) === -1) {
                tmpRedIds.push(matchingSignalAspect.signal_id);
              }
              break;
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
            default:
              break;
          }
        }
      });

      setRedSignalsIds(tmpRedIds);
      setYellowSignalsIds(tmpYellowIds);
      setGreenSignalsIds(tmpRedIds);
    }
  }, [timePosition, consolidatedSimulation, viewport, selectedTrain]);

  const getSignalsList = () => {
    let signalsList: Array<string> = [];
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

  const context: SignalContext = {
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

      {signalsList.map((sig) => {
        const layerId = `chartis/signal/${sourceLayer}/${sig}`;
        const isHovered = hovered && hovered.layer === layerId;
        const signalDef = getSignalLayerProps(context, sig, changeSignalsContext);
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
