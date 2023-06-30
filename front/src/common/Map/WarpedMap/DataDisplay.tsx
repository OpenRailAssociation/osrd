import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { omit, map, groupBy, first, last } from 'lodash';

import maplibregl from 'maplibre-gl';
import ReactMapGL, { Layer, LineLayer, MapRef, Marker, Source } from 'react-map-gl';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { featureCollection } from '@turf/helpers';
import { Feature, FeatureCollection, MultiLineString } from 'geojson';

import colors from '../Consts/colors';
import { EditorSource, SourcesDefinitionsIndex } from '../Layers/GeoJSONs';
import osmBlankStyle from '../Layers/osmBlankStyle';
import { LayerType } from '../../../applications/editor/tools/types';
import { LayerContext } from '../Layers/types';
import { ALL_SIGNAL_LAYERS } from '../Consts/SignalsNames';
import { RootState } from '../../../reducers';
import { LoaderFill } from '../../Loader';
import { genLayerProps } from '../Layers/OSM';
import { LAYER_GROUPS_ORDER, LAYERS } from '../../../config/layerOrder';
import OrderedLayer, { OrderedLayerProps } from '../Layers/OrderedLayer';
import VirtualLayers from '../../../applications/operationalStudies/components/SimulationResults/SimulationResultsMap/VirtualLayers';
import originSVG from '../../../assets/pictures/origin.svg';
import destinationSVG from '../../../assets/pictures/destination.svg';

const OSRD_LAYER_ORDERS: Record<LayerType, number> = {
  buffer_stops: LAYER_GROUPS_ORDER[LAYERS.BUFFER_STOPS.GROUP],
  detectors: LAYER_GROUPS_ORDER[LAYERS.DETECTORS.GROUP],
  signals: LAYER_GROUPS_ORDER[LAYERS.SIGNALS.GROUP],
  switches: LAYER_GROUPS_ORDER[LAYERS.SWITCHES.GROUP],
  track_sections: LAYER_GROUPS_ORDER[LAYERS.TRACKS_SCHEMATIC.GROUP],
  // Unused:
  catenaries: 0,
  lpv: 0,
  lpv_panels: 0,
  routes: 0,
  speed_sections: 0,
  errors: 0,
};

const PATH_STYLE: LineLayer = {
  id: 'data',
  type: 'line',
  paint: {
    'line-width': 5,
    'line-color': 'rgba(210, 225, 0, 0.75)',
  },
};

const DataDisplay: FC<{
  bbox: BBox2d;
  osrdLayers: Set<LayerType>;
  osrdData?: Partial<Record<LayerType, FeatureCollection>>;
  osmData?: Record<string, FeatureCollection>;
  path?: Feature<MultiLineString>;
}> = ({ bbox, osrdLayers, osrdData, osmData, path }) => {
  const prefix = 'warped/';
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const { mapStyle, layersSettings, showIGNBDORTHO } = useSelector((s: RootState) => s.map);

  useEffect(() => {
    if (!mapRef) return;

    const avgLon = (bbox[0] + bbox[2]) / 2;
    const thinBBox: BBox2d = [avgLon, bbox[1], avgLon, bbox[3]];
    setTimeout(() => {
      mapRef.fitBounds(thinBBox, { animate: false });
      mapRef.resize();
    }, 0);
  }, [mapRef, bbox]);

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
        order: OSRD_LAYER_ORDERS[layer],
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
          genLayerProps(
            mapStyle,
            LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]
          ) as (OrderedLayerProps & {
            'source-layer': string;
          })[]
        ).filter((layer) => !layer.id?.match(/-en$/)),
        (layer) => layer['source-layer']
      ),
    [mapStyle]
  );

  const origin = useMemo(
    () => (path ? first(first(path.geometry.coordinates)) : undefined),
    [path]
  );
  const destination = useMemo(
    () => (path ? last(last(path.geometry.coordinates)) : undefined),
    [path]
  );

  return osrdData && osmData ? (
    <ReactMapGL
      ref={setMapRef}
      mapLib={maplibregl}
      mapStyle={osmBlankStyle}
      style={{ width: '100%', height: '100%' }}
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
      {path && (
        <Source id="path" type="geojson" data={path}>
          <OrderedLayer {...PATH_STYLE} layerOrder={LAYER_GROUPS_ORDER[LAYERS.TRAIN.GROUP]} />
        </Source>
      )}
      {origin && (
        <Marker longitude={origin[0]} latitude={origin[1]} offset={[0, -12]}>
          <img src={originSVG} alt="Origin" style={{ height: '1.5rem' }} />
        </Marker>
      )}
      {destination && (
        <Marker longitude={destination[0]} latitude={destination[1]} offset={[0, -24]}>
          <img src={destinationSVG} alt="Destination" style={{ height: '3rem' }} />
        </Marker>
      )}
    </ReactMapGL>
  ) : (
    <LoaderFill />
  );
};

export default DataDisplay;
