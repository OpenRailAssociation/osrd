import { useEffect, useMemo, useState } from 'react';

import { featureCollection } from '@turf/helpers';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { groupBy, map, omit } from 'lodash';
import type { LngLatBoundsLike } from 'maplibre-gl';
import ReactMapGL, { Layer, type MapRef, Source } from 'react-map-gl/maplibre';

import type { Layer as LayerType } from 'applications/editor/consts';
import {
  EditorSource,
  OrderedLayer,
  SourcesDefinitionsIndex,
  VirtualLayers,
  genOSMLayerProps,
  useMapBlankStyle,
  type LayerContext,
  type OrderedLayerProps,
} from 'common/Map/Layers';
import { colors } from 'common/Map/theme';
import type { BBox2d } from 'common/Map/WarpedMap/core/helpers';
import { LAYERS, LAYER_ENTITIES_ORDERS, LAYER_GROUPS_ORDER } from 'config/layerOrder';
import RenderItinerary from 'modules/simulationResult/components/SimulationResultsMap/RenderItinerary';
import { useMapSettings } from 'reducers/commonMap';

type WarpedMapProps = {
  bbox: BBox2d;
  osrdLayers: Set<LayerType>;
  boundingBox?: LngLatBoundsLike;
  // Data to display on the map (must be transformed already):
  osrdData: Partial<Record<LayerType, FeatureCollection>>;
  osmData: Record<string, FeatureCollection>;
  itinerary?: Feature<LineString>;
};

/**
 * This component handles displaying warped data. The data must be warped before being given to this component.
 * Check `SimulationWarpedMap` to see an example use case.
 */
const WarpedMap = ({
  bbox,
  osrdLayers,
  osrdData,
  osmData,
  itinerary,
  boundingBox,
}: WarpedMapProps) => {
  const mapBlankStyle = useMapBlankStyle();

  const prefix = 'warped/';
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const { mapStyle, layersSettings, showIGNBDORTHO } = useMapSettings();

  // Main OSM and OSRD data:
  const layerContext: LayerContext = useMemo(
    () => ({
      colors: colors[mapStyle],
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
            <OrderedLayer key={layer.id} {...(omit(layer, 'source-layer') as OrderedLayerProps)} />
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
          layerOrder={LAYER_GROUPS_ORDER[LAYERS.PATH.GROUP]}
        />
      )}
    </ReactMapGL>
  );
};

export default WarpedMap;
