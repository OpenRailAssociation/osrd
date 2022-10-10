import { useSelector } from 'react-redux';
import React, { FC, useMemo } from 'react';
import { FeatureCollection } from 'geojson';
import { mapValues } from 'lodash';
import { Layer, LayerProps, Source } from 'react-map-gl';
import { AnyPaint, CirclePaint, LinePaint, SymbolPaint } from 'mapbox-gl';

import { Item, Theme } from '../../../types';
import { dataArraySelector, dataSelector } from '../../../reducers/editor';
import { geoMainLayer, geoServiceLayer } from './geographiclayers';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
  SignalsSettings,
} from './geoSignalsLayers';
import { lineNameLayer, lineNumberLayer, trackNameLayer } from './commonLayers';
import { getSymbolTypes } from '../../../applications/editor/data/utils';
import { getBufferStopsLayerProps } from './BufferStops';
import { getDetectorsLayerProps, getDetectorsNameLayerProps } from './Detectors';
import { getSwitchesLayerProps, getSwitchesNameLayerProps } from './Switches';
import { EditorState, LayerType } from 'applications/editor/tools/types';

const HOVERED_COLOR = '#009EED';
const UNSELECTED_OPACITY = 0.2;
const SIGNAL_TYPE_KEY = 'installation_type';

const NULL_FEATURE: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

interface Context {
  hiddenIDs: string[];
  hoveredIDs: string[];
  selectedIDs: string[];
}

function adaptSymbolPaint(paint: SymbolPaint, { selectedIDs, hoveredIDs }: Context): SymbolPaint {
  const opacity = typeof paint['icon-opacity'] === 'number' ? paint['icon-opacity'] : 1;
  return {
    ...paint,
    ...(selectedIDs.length
      ? {
          'icon-opacity': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedIDs]],
            opacity,
            opacity * UNSELECTED_OPACITY,
          ],
        }
      : {}),
    ...(hoveredIDs.length
      ? {
          'icon-halo-color': ['case', ['in', 'id', ...hoveredIDs], HOVERED_COLOR, 'rgba(0,0,0,0)'],
          'icon-halo-width': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
          'icon-halo-blur': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
        }
      : {}),
  };
}

function adaptCirclePaint(paint: CirclePaint, { selectedIDs, hoveredIDs }: Context): CirclePaint {
  const opacity = typeof paint['icon-opacity'] === 'number' ? paint['icon-opacity'] : 1;
  return {
    ...paint,
    ...(selectedIDs.length
      ? {
          'circle-opacity': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedIDs]],
            opacity,
            opacity * UNSELECTED_OPACITY,
          ],
        }
      : {}),
    ...(hoveredIDs.length
      ? {
          'icon-halo-color': ['case', ['in', 'id', ...hoveredIDs], HOVERED_COLOR, 'rgba(0,0,0,0)'],
          'icon-halo-width': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
          'icon-halo-blur': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
        }
      : {}),
  };
}

function adaptTextPaint(paint: SymbolPaint, { hoveredIDs, selectedIDs }: Context): SymbolPaint {
  const opacity = typeof paint['text-opacity'] === 'number' ? paint['text-opacity'] : 1;
  return {
    ...paint,
    ...(selectedIDs.length
      ? {
          'text-opacity': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedIDs]],
            opacity,
            opacity * UNSELECTED_OPACITY,
          ],
        }
      : {}),
    ...(hoveredIDs.length
      ? {
          'icon-halo-color': ['case', ['in', 'id', ...hoveredIDs], HOVERED_COLOR, 'rgba(0,0,0,0)'],
          'icon-halo-width': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
          'icon-halo-blur': ['case', ['in', 'id', ...hoveredIDs], 5, 0],
        }
      : {}),
  };
}

function adaptLinearPaint(paint: LinePaint, { selectedIDs }: Context): LinePaint {
  const opacity = typeof paint['line-opacity'] === 'number' ? paint['line-opacity'] : 1;
  return {
    ...paint,
    ...(selectedIDs.length
      ? {
          'line-opacity': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedIDs]],
            opacity,
            opacity * UNSELECTED_OPACITY,
          ],
        }
      : {}),
  };
}

function adaptFilter(filter: LayerProps['filter'], { hiddenIDs }: Context): LayerProps['filter'] {
  if (hiddenIDs.length) {
    const hiddenFilter = ['!in', 'id', ...hiddenIDs];

    if (filter) {
      return ['all', hiddenFilter, filter];
    }
    return hiddenFilter;
  }

  return filter;
}

function adaptProps<T extends AnyPaint>(
  props: LayerProps,
  context: Context,
  fn?: (paint: T, _context: Context) => T
): LayerProps {
  const res: LayerProps = {
    ...props,
  };

  if (fn) res.paint = fn((props.paint as T) || {}, context);

  const filter = adaptFilter(res.filter, context);
  if (filter) res.filter = filter;
  return res;
}

const GeoJSONs: FC<{
  colors: Theme;
  hidden?: Item[];
  hovered?: Item[];
  selection?: Item[];
  prefix?: string;
}> = (props) => {
  const { colors, hidden, hovered, selection, prefix = 'editor/' } = props;
  const { mapStyle } = useSelector(
    (s: { map: { mapStyle: string; signalsSettings: SignalsSettings } }) => s.map
  );
  const editorData = useSelector((state: { editor: EditorState }) => dataSelector(state.editor));
  const editorDataArray = useSelector((state: { editor: EditorState }) =>
    dataArraySelector(state.editor)
  );
  const geoJSONs = useMemo<Partial<Record<LayerType, FeatureCollection>>>(
    () =>
      mapValues(
        editorData,
        (entities) =>
          ({
            type: 'FeatureCollection',
            features: entities.map((e) => ({ ...e, type: 'Feature' })),
          } as FeatureCollection)
      ),
    [editorData]
  );

  const layerContext: Context = useMemo(
    () => ({
      hiddenIDs: (hidden || []).map((item) => item.id),
      hoveredIDs: (hovered || []).map((item) => item.id),
      selectedIDs: (selection || []).map((item) => item.id),
    }),
    [hidden, hovered, selection]
  );

  // SIGNALS:
  const signalsList = useMemo(() => getSymbolTypes(editorDataArray), [editorDataArray]);
  const signalsContext: SignalContext = useMemo(
    () => ({
      colors,
      signalsList,
      sourceLayer: 'geo',
      prefix: mapStyle === 'blueprint' ? 'SCHB ' : '',
    }),
    [colors, mapStyle, signalsList]
  );
  const signalPropsPerType = useMemo(
    () =>
      signalsList.reduce(
        (iter, type) => ({
          ...iter,
          [type]: getSignalLayerProps(signalsContext, type),
        }),
        {}
      ),
    [signalsContext, signalsList]
  );

  return (
    <>
      <Source
        id={`${prefix}geo/trackSections`}
        type="geojson"
        data={geoJSONs.track_sections || NULL_FEATURE}
      >
        <Layer
          {...adaptProps(geoMainLayer(colors), layerContext, adaptLinearPaint)}
          id={`${prefix}geo/track-main`}
        />
        <Layer
          {...adaptProps(geoServiceLayer(colors), layerContext, adaptLinearPaint)}
          id={`${prefix}geo/track-service`}
        />
        <Layer
          {...adaptProps(
            {
              ...trackNameLayer(colors),
              filter: ['==', 'type_voie', 'VP'],
              layout: {
                ...trackNameLayer(colors).layout,
                'text-field': '{track_name}',
                'text-size': 11,
              },
            },
            layerContext,
            adaptTextPaint
          )}
          id={`${prefix}geo/track-names`}
        />
        <Layer
          {...adaptProps(
            {
              ...lineNumberLayer(colors),
              layout: {
                ...lineNumberLayer(colors).layout,
                'text-field': '{line_code}',
              },
            },
            layerContext,
            adaptTextPaint
          )}
          id={`${prefix}geo/track-numbers`}
        />
        <Layer
          {...adaptProps(lineNameLayer(colors), layerContext, adaptTextPaint)}
          id={`${prefix}geo/line-names`}
        />
      </Source>

      <Source id={`${prefix}geo/signals`} type="geojson" data={geoJSONs.signals || NULL_FEATURE}>
        <Layer
          {...adaptProps(getSignalMatLayerProps(signalsContext), layerContext, adaptSymbolPaint)}
          id={`${prefix}geo/signal-mat`}
        />
        <Layer
          {...adaptProps(getPointLayerProps(signalsContext), layerContext)}
          id={`${prefix}geo/signal-point`}
        />
        {signalsList.map((type) => {
          const layerId = `${prefix}geo/signal-${type}`;
          const signalDef = signalPropsPerType[type];

          return (
            <Layer
              key={type}
              {...signalDef}
              id={layerId}
              filter={adaptFilter(['==', SIGNAL_TYPE_KEY, `"${type}"`], layerContext)}
              paint={adaptSymbolPaint(signalDef.paint, layerContext)}
            />
          );
        })}
      </Source>

      <Source
        id={`${prefix}geo/buffer_stops`}
        type="geojson"
        data={geoJSONs.buffer_stops || NULL_FEATURE}
      >
        <Layer
          {...adaptProps(getBufferStopsLayerProps(signalsContext), layerContext, adaptSymbolPaint)}
          id={`${prefix}geo/buffer-stop-main`}
        />
      </Source>

      <Source
        id={`${prefix}geo/detectors`}
        type="geojson"
        data={geoJSONs.detectors || NULL_FEATURE}
      >
        <Layer
          {...adaptProps(getDetectorsLayerProps(signalsContext), layerContext, adaptCirclePaint)}
          id={`${prefix}geo/detector-main`}
        />
        <Layer
          {...adaptProps(getDetectorsNameLayerProps(signalsContext), layerContext, adaptTextPaint)}
          id={`${prefix}geo/detector-name`}
        />
      </Source>

      <Source id={`${prefix}geo/switches`} type="geojson" data={geoJSONs.switches || NULL_FEATURE}>
        <Layer
          {...adaptProps(getSwitchesLayerProps(signalsContext), layerContext, adaptCirclePaint)}
          id={`${prefix}geo/switch-main`}
        />
        <Layer
          {...adaptProps(getSwitchesNameLayerProps(signalsContext), layerContext, adaptTextPaint)}
          id={`${prefix}geo/switch-name`}
        />
      </Source>
    </>
  );
};

export default GeoJSONs;
