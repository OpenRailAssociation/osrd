import { useSelector } from 'react-redux';
import React, { FC, useMemo } from 'react';
import { Feature, FeatureCollection } from 'geojson';
import { isPlainObject, keyBy, mapValues } from 'lodash';
import { Layer, LayerProps, Source } from 'react-map-gl';
import { SymbolPaint } from 'mapbox-gl';
import chroma from 'chroma-js';

import { Theme } from '../../../types';
import { geoMainLayer, geoServiceLayer } from './geographiclayers';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
  SignalsSettings,
} from './geoSignalsLayers';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from './commonLayers';
import { getSignalsList, getSymbolsList } from '../../../applications/editor/data/utils';
import { getBufferStopsLayerProps } from './BufferStops';
import { getDetectorsLayerProps, getDetectorsNameLayerProps } from './Detectors';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from './Switches';
import { EditorState, LayerType } from '../../../applications/editor/tools/types';
import { SYMBOLS_TO_LAYERS } from '../Consts/SignalsNames';

const SIGNAL_TYPE_KEY = 'extensions_sncf_installation_type';

const NULL_FEATURE: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

interface LayerContext extends SignalContext {
  symbolsList: string[];
  isEmphasized: boolean;
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
function adaptFilter(layer: LayerProps, blackList: string[], whiteList: string[]): LayerProps {
  const res = { ...layer };
  const conditions: LayerProps['filter'][] = layer.filter ? [layer.filter] : [];

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
function getTrackSectionLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    { ...geoMainLayer(context.colors), id: `${prefix}geo/track-main` },
    { ...geoServiceLayer(context.colors), id: `${prefix}geo/track-service` },
    {
      ...trackNameLayer(context.colors),
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
      layout: {
        ...lineNumberLayer(context.colors).layout,
        'text-field': '{extensions_sncf_line_code}',
      },
      id: `${prefix}geo/track-numbers`,
    },
    { ...lineNameLayer(context.colors), id: `${prefix}geo/line-names` },
  ];
}
function getSignalLayers(context: LayerContext, prefix: string): LayerProps[] {
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
function getBufferStopsLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [{ ...getBufferStopsLayerProps(context), id: `${prefix}geo/buffer-stop-main` }];
}
function getDetectorsLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    { ...getDetectorsLayerProps(context), id: `${prefix}geo/detector-main` },
    { ...getDetectorsNameLayerProps(context), id: `${prefix}geo/detector-name` },
  ];
}
function getSwitchesLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    { ...getSwitchesLayerProps(context), id: `${prefix}geo/switch-main` },
    { ...getSwitchesNameLayerProps(context), id: `${prefix}geo/switch-name` },
  ];
}

const SOURCES_DEFINITION: {
  entityType: LayerType;
  getLayers: (context: LayerContext, prefix: string) => LayerProps[];
}[] = [
  { entityType: 'track_sections', getLayers: getTrackSectionLayers },
  { entityType: 'signals', getLayers: getSignalLayers },
  { entityType: 'buffer_stops', getLayers: getBufferStopsLayers },
  { entityType: 'detectors', getLayers: getDetectorsLayers },
  { entityType: 'switches', getLayers: getSwitchesLayers },
];

export const SourcesDefinitionsIndex = mapValues(
  keyBy(SOURCES_DEFINITION, 'entityType'),
  (def) => def.getLayers
) as Record<LayerType, (context: LayerContext, prefix: string) => LayerProps[]>;

export const EditorSource: FC<{
  id?: string;
  data: Feature | FeatureCollection;
  layers: LayerProps[];
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
}> = (props) => {
  const { colors, hidden, selection, prefix = 'editor/' } = props;
  const selectedPrefix = `${prefix}selected/`;
  const hiddenColors = useMemo(
    () => transformTheme(colors, (color) => chroma(color).desaturate(50).brighten(1).hex()),
    [colors]
  );
  const { mapStyle } = useSelector(
    (s: { map: { mapStyle: string; signalsSettings: SignalsSettings } }) => s.map
  );
  const flatEntitiesByType = useSelector(
    (state: { editor: EditorState }) => state.editor.flatEntitiesByTypes
  );
  const geoJSONs = useMemo<Partial<Record<LayerType, FeatureCollection>>>(
    () =>
      mapValues(
        flatEntitiesByType,
        (entities) =>
          ({
            type: 'FeatureCollection',
            features: (entities || [])?.map((e) => ({ ...e, type: 'Feature' })),
          } as FeatureCollection)
      ),
    [flatEntitiesByType]
  );

  // SIGNALS:
  const signalsList = useMemo(
    () => getSignalsList(flatEntitiesByType.signals || []),
    [flatEntitiesByType]
  );
  const symbolsList = useMemo(
    () => getSymbolsList(flatEntitiesByType.signals || []),
    [flatEntitiesByType]
  );
  const layerContext: LayerContext = useMemo(
    () => ({
      colors,
      signalsList,
      symbolsList,
      sourceLayer: 'geo',
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
      isEmphasized: true,
    }),
    [colors, mapStyle, signalsList, symbolsList]
  );
  const hiddenLayerContext: LayerContext = useMemo(
    () => ({
      ...layerContext,
      colors: hiddenColors,
      isEmphasized: false,
    }),
    [hiddenColors, layerContext]
  );

  const sources: { id: string; data: Feature | FeatureCollection; layers: LayerProps[] }[] =
    useMemo(
      () =>
        SOURCES_DEFINITION.flatMap((source) => {
          return [
            {
              id: `${prefix}geo/${source.entityType}`,
              data: geoJSONs[source.entityType] || NULL_FEATURE,
              layers: source
                .getLayers(hiddenLayerContext, prefix)
                .map((layer) => adaptFilter(layer, (hidden || []).concat(selection || []), [])),
            },
            {
              id: `${selectedPrefix}geo/${source.entityType}`,
              data: geoJSONs[source.entityType] || NULL_FEATURE,
              layers: source
                .getLayers(layerContext, selectedPrefix)
                .map((layer) => adaptFilter(layer, hidden || [], selection || [])),
            },
          ];
        }),
      [geoJSONs, hidden, hiddenLayerContext, layerContext, prefix, selectedPrefix, selection]
    );

  return (
    <>
      {sources.map((source) => (
        <Source key={source.id} type="geojson" id={source.id} data={source.data}>
          {source.layers.map((layer) => (
            <Layer key={layer.id} {...layer} />
          ))}
        </Source>
      ))}
    </>
  );
};

export default GeoJSONs;
