import { useSelector } from 'react-redux';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { groupBy, map, omit } from 'lodash';
import { featureCollection } from '@turf/helpers';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { Feature, FeatureCollection, LineString } from 'geojson';
import ReactMapGL, { Layer, MapRef, Source } from 'react-map-gl/maplibre';
import { LngLatBoundsLike } from 'maplibre-gl';

import { LAYERS, LAYER_ENTITIES_ORDERS, LAYER_GROUPS_ORDER } from 'config/layerOrder';
import colors from 'common/Map/Consts/colors';
import { ALL_SIGNAL_LAYERS } from 'common/Map/Consts/SignalsNames';
import { LayerType } from 'applications/editor/tools/types';
import { TrainPosition } from 'modules/simulationResult/components/SimulationResultsMap/types';
import VirtualLayers from 'modules/simulationResult/components/SimulationResultsMap/VirtualLayers';
import RenderItinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import TrainHoverPosition from 'modules/simulationResult/components/SimulationResultsMap/TrainHoverPosition';
import { LayerContext } from 'common/Map/Layers/types';
import OrderedLayer, { OrderedLayerProps } from 'common/Map/Layers/OrderedLayer';
import { genOSMLayerProps } from 'common/Map/Layers/OSM';
import { useMapBlankStyle } from 'common/Map/Layers/blankStyle';
import { EditorSource, SourcesDefinitionsIndex } from 'common/Map/Layers/GeoJSONs';
import { Viewport } from 'reducers/map';
import { getMap } from 'reducers/map/selectors';
import { AllowancesSettings, Train } from 'reducers/osrdsimulation/types';

/**
 * This component handles displaying warped data. The data must be warped before being given to this component.
 * Check `SimulationWarpedMap` to see an example use case.
 */
const WarpedMap: FC<{
  bbox: BBox2d;
  osrdLayers: Set<LayerType>;
  boundingBox?: LngLatBoundsLike;
  // Data to display on the map (must be transformed already):
  osrdData: Partial<Record<LayerType, FeatureCollection>>;
  osmData: Record<string, FeatureCollection>;
  trainsPositions?: (TrainPosition & { train: Train; isSelected?: boolean })[];
  itinerary?: Feature<LineString>;
  allowancesSettings?: AllowancesSettings;
}> = ({
  bbox,
  osrdLayers,
  osrdData,
  osmData,
  trainsPositions,
  itinerary,
  boundingBox,
  allowancesSettings,
}) => {
  const mapBlankStyle = useMapBlankStyle();

  const prefix = 'warped/';
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector(getMap);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  // Main OSM and OSRD data:
  const layerContext: LayerContext = useMemo(
    () => ({
      colors: colors[mapStyle],
      signalsList: ALL_SIGNAL_LAYERS,
      symbolsList: ALL_SIGNAL_LAYERS,
      sourceLayer: 'geo',
      prefix: '',
      isEmphasized: false,
      showIGNBDORTHO,
      layersSettings,
    }),
    [colors, mapStyle, showIGNBDORTHO, layersSettings]
  );
  const osrdSources = useMemo(
    () =>
      Array.from(osrdLayers).map((layer) => ({
        source: layer,
        order: LAYER_ENTITIES_ORDERS[layer],
        id: `${prefix}geo/${layer}`,
        layers: SourcesDefinitionsIndex[layer](layerContext, prefix).map(
          (props) => omit(props, 'source-layer') as typeof props
        ),
      })),
    [osrdLayers]
  );
  const osmSources = useMemo(
    () =>
      groupBy(
        (
          genOSMLayerProps(
            mapStyle,
            {},
            LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]
          ) as (OrderedLayerProps & {
            'source-layer': string;
          })[]
        ).filter(
          // Here, we filter out various OSM layers (visible in OSMStyle.json), such as:
          // - "poi_label-en"
          // - "road_major_label-en"
          // - "place_label_other-en"
          // - ...
          (layer) => !layer.id?.match(/-en$/)
        ),
        (layer) => layer['source-layer']
      ),
    [mapStyle]
  );

  // This effect handles the map initial position:
  useEffect(() => {
    if (!mapRef) return;

    const avgLon = (bbox[0] + bbox[2]) / 2;
    const thinBBox: BBox2d = [avgLon, bbox[1], avgLon, bbox[3]];
    setTimeout(() => {
      mapRef.fitBounds(boundingBox || thinBBox, { animate: false });
      mapRef.resize();
    }, 0);
  }, [mapRef, bbox, boundingBox]);

  // This effect handles bounding box updates:
  useEffect(() => {
    if (!mapRef || !boundingBox) return;

    mapRef.fitBounds(boundingBox);
    mapRef.resize();
  }, [boundingBox]);

  return (
    <ReactMapGL
      ref={setMapRef}
      mapStyle={mapBlankStyle}
      style={{ width: '100%', height: '100%' }}
      onMove={(e) => {
        setViewport({
          ...e.viewState,
          width: e.target.getContainer().offsetWidth,
          height: e.target.getContainer().offsetHeight,
        });
      }}
      // Viewport specifics:
      dragPan={!boundingBox}
      doubleClickZoom={!boundingBox}
      scrollZoom={!boundingBox}
      interactive={!boundingBox}
    >
      <Layer type="background" paint={{ 'background-color': 'white' }} />
      <VirtualLayers />
      {map(osmSources, (layers, sourceLayer) => (
        <Source
          key={sourceLayer}
          id={`osm-${sourceLayer}`}
          type="geojson"
          data={osmData[sourceLayer] || featureCollection([])}
        >
          {layers.map((layer) => (
            <OrderedLayer {...(omit(layer, 'source-layer') as OrderedLayerProps)} />
          ))}
        </Source>
      ))}
      {osrdSources.map((s) => (
        <EditorSource
          key={s.id}
          id={s.id}
          layers={s.layers}
          data={osrdData[s.source] || featureCollection([])}
          layerOrder={s.order}
        />
      ))}
      {itinerary && (
        <RenderItinerary
          geojsonPath={itinerary}
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.ITINERARY.GROUP]}
        />
      )}
      {itinerary &&
        viewport &&
        trainsPositions?.map((position) => (
          <TrainHoverPosition
            key={position.id}
            point={position}
            train={position.train}
            geojsonPath={itinerary}
            isSelectedTrain={position.isSelected}
            layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]}
            allowancesSettings={allowancesSettings}
            viewport={viewport}
          />
        ))}
    </ReactMapGL>
  );
};

export default WarpedMap;
