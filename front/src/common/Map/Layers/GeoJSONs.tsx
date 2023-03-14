import { useSelector } from 'react-redux';
import React, { FC, useEffect, useMemo, useState } from 'react';
import chroma from 'chroma-js';
import { Feature, FeatureCollection } from 'geojson';
import { isPlainObject, keyBy, mapValues } from 'lodash';
import { Layer, Source } from 'react-map-gl';

import { SymbolPaint } from 'mapbox-gl';

import { AnyLayer, Theme } from '../../../types';
import { RootState } from '../../../reducers';
import { geoMainLayer, geoServiceLayer } from './geographiclayers';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
} from './geoSignalsLayers';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from './commonLayers';
import { getBufferStopsLayerProps } from './BufferStops';
import { getDetectorsLayerProps, getDetectorsNameLayerProps } from './Detectors';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from './Switches';
import {
  getLineErrorsLayerProps,
  getPointErrorsLayerProps,
  getLineTextErrorsLayerProps,
  getPointTextErrorsLayerProps,
} from './Errors';
import { LayerType, OSRDConf } from '../../../applications/editor/tools/types';
import { ALL_SIGNAL_LAYERS, SYMBOLS_TO_LAYERS } from '../Consts/SignalsNames';
import { MAP_TRACK_SOURCE, MAP_URL } from '../const';

const SIGNAL_TYPE_KEY = 'extensions_sncf_installation_type';

const POINT_ENTITIES_MIN_ZOOM = 12;

interface LayerContext extends SignalContext {
  sourceTable?: string;
  symbolsList: string[];
  isEmphasized: boolean;
  showIGNBDORTHO: boolean;
}

/**
 * Helper to recursively transform all colors of a given theme:
 */
function transformTheme(theme: Theme, reducer: (color: string) => string): Theme {
  function search<T extends string | Record<string, unknown>>(input: T): T {
    if (typeof input === 'string') return reducer(input) as T;
    if (isPlainObject(input)) return mapValues(input, search) as T;
    return input;
  }

  return search(theme);
}

/**
 * Helper to add filters to existing LayerProps.filter values:
 */
function adaptFilter(layer: AnyLayer, blackList: string[], whiteList: string[]): AnyLayer {
  const res = { ...layer };
  const conditions: AnyLayer['filter'][] = layer.filter ? [layer.filter] : [];

  if (whiteList.length) conditions.push(['in', 'id', ...whiteList]);
  if (blackList.length) conditions.push(['!in', 'id', ...blackList]);

  switch (conditions.length) {
    case 0:
      return res;
    case 1:
      return { ...res, filter: conditions[0] };
    default:
      return { ...res, filter: ['all', ...conditions] };
  }
}

/**
 * Helpers to get all layers required to render entities of a given type:
 */
function getTrackSectionLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    {
      ...geoMainLayer(context.colors, context.showIGNBDORTHO),
      'source-layer': MAP_TRACK_SOURCE,
      id: `${prefix}geo/track-main`,
    },
    {
      ...geoServiceLayer(context.colors),
      'source-layer': MAP_TRACK_SOURCE,
      id: `${prefix}geo/track-service`,
    },
    {
      ...trackNameLayer(context.colors),
      'source-layer': MAP_TRACK_SOURCE,
      filter: ['==', 'type_voie', 'VP'],
      layout: {
        ...trackNameLayer(context.colors).layout,
        'text-field': '{extensions_sncf_track_name}',
        'text-size': 11,
      },
      id: `${prefix}geo/track-vp-names`,
    },
    {
      ...trackNameLayer(context.colors),
      'source-layer': MAP_TRACK_SOURCE,
      filter: ['!=', 'type_voie', 'VP'],
      layout: {
        ...trackNameLayer(context.colors).layout,
        'text-field': '{extensions_sncf_track_name}',
        'text-size': 10,
      },
      id: `${prefix}geo/track-other-names`,
    },
    {
      ...lineNumberLayer(context.colors),
      'source-layer': MAP_TRACK_SOURCE,
      layout: {
        ...lineNumberLayer(context.colors).layout,
        'text-field': '{extensions_sncf_line_code}',
      },
      id: `${prefix}geo/track-numbers`,
    },
    {
      ...lineNameLayer(context.colors),
      'source-layer': MAP_TRACK_SOURCE,
      id: `${prefix}geo/line-names`,
    },
  ];
}

function getSignalLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    { ...getSignalMatLayerProps(context), id: `${prefix}geo/signal-mat` },
    { ...getPointLayerProps(context), id: `${prefix}geo/signal-point` },
  ].concat(
    context.symbolsList.map((symbol) => {
      const props = getSignalLayerProps(context, symbol);
      const paint = props.paint as SymbolPaint;
      const opacity = typeof paint['icon-opacity'] === 'number' ? paint['icon-opacity'] : 1;

      return {
        ...props,
        paint: { ...props.paint, 'icon-opacity': opacity * (context.isEmphasized ? 1 : 0.2) },
        filter: ['==', SIGNAL_TYPE_KEY, SYMBOLS_TO_LAYERS[symbol]],
        id: `${prefix}geo/signal-${symbol}`,
      };
    })
  );
}
function getBufferStopsLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    {
      ...getBufferStopsLayerProps(context),
      id: `${prefix}geo/buffer-stop-main`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
  ];
}
function getDetectorsLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    {
      ...getDetectorsLayerProps(context),
      id: `${prefix}geo/detector-main`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
    {
      ...getDetectorsNameLayerProps(context),
      id: `${prefix}geo/detector-name`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
  ];
}
function getSwitchesLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    {
      ...getSwitchesLayerProps(context),
      id: `${prefix}geo/switch-main`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
    {
      ...getSwitchesNameLayerProps(context),
      id: `${prefix}geo/switch-name`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
  ];
}

function getErrorsLayers(context: LayerContext, prefix: string): AnyLayer[] {
  return [
    {
      ...getLineErrorsLayerProps(context),
      id: `${prefix}geo/errors-line`,
    },
    {
      ...getLineTextErrorsLayerProps(context),
      id: `${prefix}geo/errors-line-label`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
    {
      ...getPointErrorsLayerProps(context),
      id: `${prefix}geo/errors-point`,
    },
    {
      ...getPointTextErrorsLayerProps(context),
      id: `${prefix}geo/errors-point-label`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
  ];
}

const SOURCES_DEFINITION: {
  entityType: LayerType;
  getLayers: (context: LayerContext, prefix: string) => AnyLayer[];
}[] = [
  { entityType: 'track_sections', getLayers: getTrackSectionLayers },
  { entityType: 'signals', getLayers: getSignalLayers },
  { entityType: 'buffer_stops', getLayers: getBufferStopsLayers },
  { entityType: 'detectors', getLayers: getDetectorsLayers },
  { entityType: 'switches', getLayers: getSwitchesLayers },
  { entityType: 'errors', getLayers: getErrorsLayers },
];

export const SourcesDefinitionsIndex = mapValues(
  keyBy(SOURCES_DEFINITION, 'entityType'),
  (def) => def.getLayers
) as Record<LayerType, (context: LayerContext, prefix: string) => AnyLayer[]>;

export const EditorSource: FC<{
  id?: string;
  data: Feature | FeatureCollection;
  layers: AnyLayer[];
}> = ({ id, data, layers }) => (
  <Source type="geojson" id={id} data={data}>
    {layers.map((layer) => (
      <Layer key={layer.id} {...layer} />
    ))}
  </Source>
);

const GeoJSONs: FC<{
  colors: Theme;
  hidden?: string[];
  selection?: string[];
  prefix?: string;
  layers?: Set<LayerType>;
  fingerprint?: string | number;
}> = ({ colors, hidden, selection, layers, fingerprint, prefix = 'editor/' }) => {
  const osrdConf = useSelector((state: { osrdconf: OSRDConf }) => state.osrdconf);
  const selectedPrefix = `${prefix}selected/`;
  const hiddenColors = useMemo(
    () => transformTheme(colors, (color) => chroma(color).desaturate(50).brighten(1).hex()),
    [colors]
  );

  // This flag is used to unmount sources before mounting the new ones, when
  // fingerprint is updated;
  const [skipSources, setSkipSources] = useState(true);
  useEffect(() => {
    setSkipSources(true);
    const timeout = setTimeout(() => setSkipSources(false), 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [fingerprint]);

  const { mapStyle, showIGNBDORTHO } = useSelector((s: RootState) => s.map);

  const layerContext: LayerContext = useMemo(
    () => ({
      colors,
      signalsList: ALL_SIGNAL_LAYERS,
      symbolsList: ALL_SIGNAL_LAYERS,
      sourceLayer: 'geo',
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
      isEmphasized: true,
      showIGNBDORTHO,
    }),
    [colors, mapStyle, showIGNBDORTHO]
  );
  const hiddenLayerContext: LayerContext = useMemo(
    () => ({
      ...layerContext,
      colors: hiddenColors,
      isEmphasized: false,
    }),
    [hiddenColors, layerContext]
  );

  const sources: { id: string; url: string; layers: AnyLayer[] }[] = useMemo(
    () =>
      SOURCES_DEFINITION.flatMap((source) =>
        !layers || layers.has(source.entityType)
          ? [
              {
                id: `${prefix}geo/${source.entityType}`,
                url: `${MAP_URL}/layer/${source.entityType}/mvt/geo/?infra=${osrdConf.infraID}`,
                layers: source
                  .getLayers({ ...hiddenLayerContext, sourceTable: source.entityType }, prefix)
                  .map((layer) => adaptFilter(layer, (hidden || []).concat(selection || []), [])),
              },
              {
                id: `${selectedPrefix}geo/${source.entityType}`,
                url: `${MAP_URL}/layer/${source.entityType}/mvt/geo/?infra=${osrdConf.infraID}`,
                layers: source
                  .getLayers({ ...layerContext, sourceTable: source.entityType }, selectedPrefix)
                  .map((layer) => adaptFilter(layer, hidden || [], selection || [])),
              },
            ]
          : []
      ),
    [
      hidden,
      hiddenLayerContext,
      layerContext,
      layers,
      osrdConf.infraID,
      prefix,
      selectedPrefix,
      selection,
    ]
  );

  return (
    <>
      {!skipSources &&
        sources.map((source) => (
          <Source key={source.id} promoteId="id" type="vector" url={source.url}>
            {source.layers.map((layer) => (
              <Layer key={layer.id} {...layer} />
            ))}
          </Source>
        ))}
    </>
  );
};

export default GeoJSONs;
