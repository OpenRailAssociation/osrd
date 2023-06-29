import React, { FC, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { omit, map, groupBy } from 'lodash';

import maplibregl from 'maplibre-gl';
import ReactMapGL, { Layer, MapRef, Source } from 'react-map-gl';
import { BBox2d } from '@turf/helpers/dist/js/lib/geojson';
import { featureCollection } from '@turf/helpers';
import { FeatureCollection } from 'geojson';

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

const DataDisplay: FC<{
  bbox: BBox2d;
  osrdLayers: Set<LayerType>;
  osrdData?: Partial<Record<LayerType, FeatureCollection>>;
  osmData?: Record<string, FeatureCollection>;
}> = ({ bbox, osrdLayers, osrdData, osmData }) => {
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
        genLayerProps(
          mapStyle,
          LAYER_GROUPS_ORDER[LAYERS.BACKGROUND.GROUP]
        ) as (OrderedLayerProps & {
          'source-layer': string;
        })[],
        (layer) => layer['source-layer']
      ),
    [mapStyle]
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
    </ReactMapGL>
  ) : (
    <LoaderFill />
  );
};

export default DataDisplay;
