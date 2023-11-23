import { useSelector } from 'react-redux';
import React, { FC, useEffect, useMemo, useState } from 'react';
import chroma from 'chroma-js';
import { Feature, FeatureCollection } from 'geojson';
import { isPlainObject, mapValues, omit } from 'lodash';
import { AnyLayer, Layer, Source, LayerProps } from 'react-map-gl/maplibre';
import { FilterSpecification } from 'maplibre-gl';

import { LayerType } from 'applications/editor/tools/types';
import { RootState } from 'reducers';
import { MapState } from 'reducers/map';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { LAYERS, LAYER_ENTITIES_ORDERS, LAYER_GROUPS_ORDER } from 'config/layerOrder';
import { Theme } from 'types';
import { geoMainLayer, geoServiceLayer } from './geographiclayers';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
} from './geoSignalsLayers';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from './commonLayers';
import { getBufferStopsLayerProps } from './BufferStops';
import { getDetectorsLayerProps, getDetectorsNameLayerProps } from './Detectors';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from './Switches';
import {
  getLineErrorsLayerProps,
  getLineTextErrorsLayerProps,
  getPointErrorsLayerProps,
  getPointTextErrorsLayerProps,
} from './Errors';
import { MAP_TRACK_SOURCE, MAP_URL } from '../const';
import {
  getSpeedSectionsFilter,
  getSpeedSectionsLineLayerProps,
  getSpeedSectionsPointLayerProps,
  getSpeedSectionsTextLayerProps,
} from './SpeedLimits';
import {
  getPSLFilter,
  getPSLSpeedLineBGLayerProps,
  getPSLSpeedLineLayerProps,
  getPSLSpeedValueLayerProps,
} from './extensions/SNCF/SNCF_PSL';
import { getPSLSignsLayerProps, getPSLSignsMastLayerProps } from './extensions/SNCF/SNCF_PSL_SIGNS';
import { LayerContext } from './types';
import { getCatenariesProps, getCatenariesTextParams } from './Catenaries';
import configKPLabelLayer from './configKPLabelLayer';
import OrderedLayer from './OrderedLayer';
import { Platforms } from './Platforms';

const POINT_ENTITIES_MIN_ZOOM = 12;

const ERROR_LAYERS_ID_SUFFIX = [
  'geo/errors-line',
  'geo/errors-line-label',
  'geo/errors-point',
  'geo/errors-point-label',
];

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
 * Helper to check if some MapLibre filter contains some ExpressionFilterSpecification,
 * or only LegacyFilterSpecification:
 */
const LEGACY_SIMPLE_OPERATORS = new Set([
  'has',
  '!has',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'in',
  '!in',
]);
const LEGACY_NESTED_OPERATORS = new Set(['all', 'any', 'none']);
const LEGACY_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
function isLegacyFilter(filter: FilterSpecification | null): boolean {
  if (!filter) return false;

  if (typeof filter === 'boolean') return false;

  if (Array.isArray(filter)) {
    const [operator, ...args] = filter;
    if (LEGACY_NESTED_OPERATORS.has(operator))
      return args.every((value) => isLegacyFilter(value as FilterSpecification));
    if (LEGACY_SIMPLE_OPERATORS.has(operator))
      return args.every((value) => LEGACY_VALUE_TYPES.has(typeof value));
  }

  return false;
}

/**
 * Helper to add filters to existing LayerProps.filter values.
 * @param layer
 * @param idsToHide An array of entity IDs to hide
 * @param onlyIdsToShow An array of only entity IDs to show (only considered
 *                      when not empty)
 * @param removeZoomContraint If true, the existing 'minzoom' filters from the
 *                            input layer props are removed from the output
 *                            result
 */
function adaptFilter(
  layer: LayerProps,
  idsToHide: string[],
  onlyIdsToShow: string[],
  removeZoomContraint?: boolean
): LayerProps {
  if (layer.type === 'background') return layer;

  const updatedLayer: LayerProps = removeZoomContraint
    ? (omit(layer, 'minzoom') as LayerProps)
    : { ...layer };
  const conditions: FilterSpecification[] = layer.filter ? [layer.filter] : [];

  // MapLibre does not allow combining in a logical tree expression filters and legacy filters.
  // We have to check that the existing filters do not contain expression filters:
  const hasExpressionFilters = !isLegacyFilter(layer.filter as FilterSpecification);

  // Get the field name of the id field. Default is 'id', but for example on error layers its obj_id
  let fieldId = 'id';
  if (layer.id && ERROR_LAYERS_ID_SUFFIX.some((suffix) => layer.id?.endsWith(suffix)))
    fieldId = 'obj_id';
  if (hasExpressionFilters) {
    // Add the conditions as ExpressionFilterSpecification:
    if (onlyIdsToShow.length) conditions.push(['in', ['get', fieldId], ['literal', onlyIdsToShow]]);
    if (idsToHide.length) conditions.push(['!', ['in', ['get', fieldId], ['literal', idsToHide]]]);
  } else {
    // Add the conditions as LegacyFilterSpecification:
    if (onlyIdsToShow.length) conditions.push(['in', fieldId, ...onlyIdsToShow]);
    if (idsToHide.length) conditions.push(['!in', fieldId, ...idsToHide]);
  }

  switch (conditions.length) {
    case 0:
      return updatedLayer;
    case 1:
      return { ...updatedLayer, filter: conditions[0] } as LayerProps;
    default:
      // for 'all' predicate, 'conditions' must be a 'LegacyFilterSpecification' type
      // that why we use the 'as'
      return { ...updatedLayer, filter: ['all', ...conditions] } as LayerProps;
  }
}

/**
 * Helpers to get all layers required to render entities of a given type:
 */
function getTrackSectionLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    {
      ...geoMainLayer(context.colors, context.showIGNBDORTHO),
      id: `${prefix}geo/track-main`,
    },
    {
      ...geoServiceLayer(context.colors),
      id: `${prefix}geo/track-service`,
    },
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
    {
      ...lineNameLayer(context.colors),
      id: `${prefix}geo/line-names`,
    },
  ];
}

function getSignalLayers(context: LayerContext, prefix: string): LayerProps[] {
  const signalProps = getSignalLayerProps(context);
  const { paint } = signalProps;
  const opacity = paint && typeof paint['icon-opacity'] === 'number' ? paint['icon-opacity'] : 1;
  return [
    { ...getSignalMatLayerProps(context), id: `${prefix}geo/signal-mat` },
    { ...getPointLayerProps(context), id: `${prefix}geo/signal-point` },
    {
      ...configKPLabelLayer({
        bottomOffset: 6.5,
        colors: context.colors,
        fieldName: 'extensions_sncf_kp',
        minzoom: 12,
        isSignalisation: true,
        sourceLayer: context.sourceTable || '',
      }),
      id: `${prefix}geo/signal-kp`,
    },
    {
      ...signalProps,
      paint: { ...signalProps.paint, 'icon-opacity': opacity * (context.isEmphasized ? 1 : 0.2) },
      id: `${prefix}geo/signal`,
    },
  ];
}
function getBufferStopsLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    {
      ...getBufferStopsLayerProps(context),
      id: `${prefix}geo/buffer-stop-main`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
  ];
}

function getCatenariesLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    {
      ...getCatenariesProps(context),
      id: `${prefix}geo/catenaries-main`,
    },
    {
      ...getCatenariesTextParams(context),
      id: `${prefix}geo/catenaries-names`,
    },
  ];
}

function getDetectorsLayers(context: LayerContext, prefix: string): LayerProps[] {
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

function getPSLSignsLayers(context: LayerContext, prefix: string): LayerProps[] {
  return [
    {
      ...getPSLSignsLayerProps(context),
      id: `${prefix}geo/psl-signs`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
    {
      ...getPSLSignsMastLayerProps(context),
      id: `${prefix}geo/psl-signs-mast`,
      minzoom: POINT_ENTITIES_MIN_ZOOM,
    },
    {
      ...configKPLabelLayer({
        colors: context.colors,
        minzoom: 9.5,
        isSignalisation: true,
        sourceLayer: 'psl_signs',
      }),
      id: `${prefix}geo/psl-signs-kp`,
    },
  ];
}

function getPSLLayers(context: LayerContext, prefix: string): LayerProps[] {
  const filter = getPSLFilter(context.layersSettings);
  const bgProps = getPSLSpeedLineBGLayerProps(context);
  const layerProps = getPSLSpeedLineLayerProps(context);

  return [
    {
      ...getPSLSpeedValueLayerProps(context),
      id: `${prefix}geo/psl-value`,
      filter,
    },
    {
      ...bgProps,
      id: `${prefix}geo/psl-line-bg`,
      paint: context.isEmphasized ? bgProps.paint : { ...bgProps.paint, 'line-width': 1 },
      filter,
    },
    {
      ...layerProps,
      id: `${prefix}geo/psl-line`,
      paint: context.isEmphasized
        ? layerProps.paint
        : { ...layerProps.paint, 'line-width': 1, 'line-opacity': 0.2 },
      filter,
    },
  ];
}

function getSwitchesLayers(context: LayerContext, prefix: string): LayerProps[] {
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

function getSpeedSectionLayers(context: LayerContext, prefix: string): LayerProps[] {
  const filter = getSpeedSectionsFilter(context.layersSettings);
  return [
    {
      ...getSpeedSectionsLineLayerProps(context),
      id: `${prefix}geo/speed-sections-line`,
      filter,
    },
    {
      ...getSpeedSectionsPointLayerProps(context),
      id: `${prefix}geo/speed-sections-point`,
      filter,
    },
    {
      ...getSpeedSectionsTextLayerProps(context),
      id: `${prefix}geo/speed-sections-text`,
      filter,
    },
  ];
}

function getErrorsLayers(context: LayerContext, prefix: string): LayerProps[] {
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
  getLayers: (context: LayerContext, prefix: string) => LayerProps[];
}[] = [
  { entityType: 'track_sections', getLayers: getTrackSectionLayers },
  { entityType: 'signals', getLayers: getSignalLayers },
  { entityType: 'buffer_stops', getLayers: getBufferStopsLayers },
  { entityType: 'detectors', getLayers: getDetectorsLayers },
  { entityType: 'switches', getLayers: getSwitchesLayers },
  { entityType: 'speed_sections', getLayers: getSpeedSectionLayers },
  { entityType: 'psl', getLayers: getPSLLayers },
  { entityType: 'psl_signs', getLayers: getPSLSignsLayers },
  { entityType: 'catenaries', getLayers: getCatenariesLayers },
  { entityType: 'errors', getLayers: getErrorsLayers },
];

export const SourcesDefinitionsIndex = SOURCES_DEFINITION.reduce(
  (acc, curr) => ({ ...acc, [curr.entityType]: curr.getLayers }),
  {} as Record<LayerType, (context: LayerContext, prefix: string) => AnyLayer[]>
);

export const EditorSource: FC<{
  id?: string;
  data: Feature | FeatureCollection;
  layers: AnyLayer[];
  layerOrder?: number;
}> = ({ id, data, layers, layerOrder }) => (
  <Source type="geojson" id={id} data={data}>
    {layers.map((layer) =>
      typeof layerOrder === 'number' ? (
        <OrderedLayer key={layer.id} {...layer} layerOrder={layerOrder} />
      ) : (
        <Layer key={layer.id} {...layer} />
      )
    )}
  </Source>
);

const GeoJSONs: FC<{
  colors: Theme;
  layersSettings: MapState['layersSettings'];
  issuesSettings?: MapState['issuesSettings'];
  hidden?: string[];
  selection?: string[];
  prefix?: string;
  layers?: Set<LayerType>;
  fingerprint?: string | number;
  isEmphasized?: boolean;
  beforeId?: string;
  // When true, all layers are rendered (ie "minZoom" restrictions are ignored)
  renderAll?: boolean;
}> = ({
  colors,
  layersSettings,
  issuesSettings,
  hidden,
  selection,
  layers,
  fingerprint,
  prefix = 'editor/',
  isEmphasized = true,
  beforeId,
  renderAll,
}) => {
  const infraID = useSelector(getInfraID);
  const selectedPrefix = `${prefix}selected/`;
  const hiddenColors = useMemo(
    () =>
      transformTheme(colors, (color) =>
        chroma.average([color, colors.background.color], 'lab', [1.5, 1]).hex()
      ),
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
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
      isEmphasized,
      showIGNBDORTHO,
      layersSettings,
      issuesSettings,
    }),
    [colors, mapStyle, showIGNBDORTHO, layersSettings, issuesSettings]
  );
  const hiddenLayerContext: LayerContext = useMemo(
    () => ({
      ...layerContext,
      colors: hiddenColors,
      isEmphasized: false,
    }),
    [hiddenColors, layerContext]
  );

  const sources = useMemo(
    () =>
      SOURCES_DEFINITION.flatMap((source) =>
        !layers || layers.has(source.entityType)
          ? [
              {
                id: `${prefix}geo/${source.entityType}`,
                url: `${MAP_URL}/layer/${source.entityType}/mvt/geo/?infra=${infraID}`,
                layerOrder: LAYER_ENTITIES_ORDERS[source.entityType],
                layers: source
                  .getLayers({ ...hiddenLayerContext, sourceTable: source.entityType }, prefix)
                  .map((layer) =>
                    adaptFilter(layer, (hidden || []).concat(selection || []), [], renderAll)
                  ),
              },
              {
                id: `${selectedPrefix}geo/${source.entityType}`,
                url: `${MAP_URL}/layer/${source.entityType}/mvt/geo/?infra=${infraID}`,
                layerOrder: LAYER_ENTITIES_ORDERS[source.entityType],
                layers: source
                  .getLayers({ ...layerContext, sourceTable: source.entityType }, selectedPrefix)
                  .map((layer) => adaptFilter(layer, hidden || [], selection || [], renderAll)),
              },
            ]
          : []
      ),
    [
      hidden,
      hiddenLayerContext,
      layerContext,
      layers,
      infraID,
      prefix,
      selectedPrefix,
      selection,
      renderAll,
    ]
  );

  if (skipSources) {
    return null;
  }
  return (
    <>
      {sources.map((source) => (
        <Source key={source.id} promoteId="id" type="vector" url={source.url} id={source.id}>
          {source.layers.map((layer) => (
            <OrderedLayer
              source-layer={MAP_TRACK_SOURCE}
              key={layer.id}
              {...layer}
              beforeId={beforeId}
              layerOrder={source.layerOrder}
            />
          ))}
        </Source>
      ))}

      {/* platform's data are not managed by OSRD, that's why they are here */}
      {layers?.has('platforms') && (
        <Platforms colors={colors} layerOrder={LAYER_GROUPS_ORDER[LAYERS.PLATFORMS.GROUP]} />
      )}
    </>
  );
};

export default GeoJSONs;
