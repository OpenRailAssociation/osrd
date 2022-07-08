import { useSelector } from 'react-redux';
import React, { FC, useMemo } from 'react';
import { FeatureCollection } from 'geojson';
import { Layer, LayerProps, Source } from 'react-map-gl';
import { AnyPaint, LinePaint, SymbolPaint } from 'mapbox-gl';

import { Item, Theme } from '../../../types';
import { clippedDataSelector, EditorState } from '../../../reducers/editor';
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

const HOVERED_COLOR = '#009EED';
const UNSELECTED_OPACITY = 0.2;
const SIGNAL_TYPE_KEY = 'installation_type';

interface PaintContext {
  hiddenIDs: string[];
  hoveredIDs: string[];
  selectedIDs: string[];
}

function adaptSymbolPaint(
  paint: SymbolPaint,
  { selectedIDs, hoveredIDs }: PaintContext
): SymbolPaint {
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
          'icon-halo-color': [
            'case',
            ['in', ['get', 'id'], ['literal', hoveredIDs]],
            HOVERED_COLOR,
            'rgba(0,0,0,0)',
          ],
          'icon-halo-width': ['case', ['in', ['get', 'id'], ['literal', hoveredIDs]], 5, 0],
          'icon-halo-blur': ['case', ['in', ['get', 'id'], ['literal', hoveredIDs]], 5, 0],
        }
      : {}),
  };
}

function adaptTextPaint(
  paint: SymbolPaint,
  { hoveredIDs, selectedIDs }: PaintContext
): SymbolPaint {
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
          'icon-halo-color': [
            'case',
            ['in', ['get', 'id'], ['literal', hoveredIDs]],
            HOVERED_COLOR,
            'rgba(0,0,0,0)',
          ],
          'icon-halo-width': ['case', ['in', ['get', 'id'], ['literal', hoveredIDs]], 5, 0],
          'icon-halo-blur': ['case', ['in', ['get', 'id'], ['literal', hoveredIDs]], 5, 0],
        }
      : {}),
  };
}

function adaptLinearPaint(paint: LinePaint, { selectedIDs }: PaintContext): LinePaint {
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

function adaptPaint<T extends AnyPaint>(
  props: LayerProps,
  fn: (paint: T, context: PaintContext) => T,
  context: PaintContext
): LayerProps {
  return {
    ...props,
    paint: fn((props.paint as T) || {}, context),
  };
}

const GeoJSONs: FC<{ colors: Theme; hidden?: Item[]; hovered?: Item[]; selection?: Item[] }> = (
  props
) => {
  const { colors, hidden, hovered, selection } = props;
  const { mapStyle } = useSelector(
    (s: { map: { mapStyle: string; signalsSettings: SignalsSettings } }) => s.map
  );
  const editorData = useSelector((state: { editor: EditorState }) =>
    clippedDataSelector(state.editor)
  );
  const geoJSON = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: editorData,
    }),
    [editorData]
  );
  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';

  const paintContext: PaintContext = useMemo(
    () => ({
      hiddenIDs: (hidden || []).map((item) => item.id),
      hoveredIDs: (hovered || []).map((item) => item.id),
      selectedIDs: (selection || []).map((item) => item.id),
    }),
    [hidden, hovered, selection]
  );

  // SIGNALS:
  const signalsList = useMemo(() => getSymbolTypes(editorData), [editorData]);
  const signalsContext: SignalContext = useMemo(
    () => ({
      prefix,
      colors,
      signalsList,
      sourceLayer: 'geo',
    }),
    [colors, prefix, signalsList]
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
    <Source id="editor/geo" type="geojson" data={geoJSON}>
      {/* Linear objects */}
      <Layer
        {...adaptPaint(geoMainLayer(colors), adaptLinearPaint, paintContext)}
        id="editor/geo/track-main"
      />
      <Layer
        {...adaptPaint(geoServiceLayer(colors), adaptLinearPaint, paintContext)}
        id="editor/geo/track-service"
      />
      <Layer
        {...adaptPaint(
          {
            ...trackNameLayer(colors),
            filter: ['==', 'type_voie', 'VP'],
            layout: {
              ...trackNameLayer(colors).layout,
              'text-field': '{track_name}',
              'text-size': 11,
            },
          },
          adaptTextPaint,
          paintContext
        )}
        id="editor/geo/track-names"
      />
      <Layer
        {...adaptPaint(
          {
            ...trackNameLayer(colors),
            filter: ['!=', 'type_voie', 'VP'],
            layout: {
              ...trackNameLayer(colors).layout,
              'text-field': '{track_name}',
              'text-size': 10,
            },
          },
          adaptTextPaint,
          paintContext
        )}
        id="editor/geo/track-names"
      />
      <Layer
        {...adaptPaint(
          {
            ...lineNumberLayer(colors),
            layout: {
              ...lineNumberLayer(colors).layout,
              'text-field': '{line_code}',
            },
          },
          adaptTextPaint,
          paintContext
        )}
        id="editor/geo/track-numbers"
      />
      <Layer
        {...adaptPaint(lineNameLayer(colors), adaptTextPaint, paintContext)}
        id="editor/geo/line-names"
      />

      {/* Point objects */}
      <Layer
        {...adaptPaint(getSignalMatLayerProps(signalsContext), adaptSymbolPaint, paintContext)}
        id="editor/geo/signal-mat"
      />
      <Layer {...getPointLayerProps(signalsContext)} id="editor/geo/signal-point" />
      {signalsList.map((type) => {
        const layerId = `editor/geo/signal-${type}`;
        const signalDef = signalPropsPerType[type];

        return (
          <Layer
            key={type}
            {...signalDef}
            id={layerId}
            filter={['==', SIGNAL_TYPE_KEY, `"${type}"`]}
            paint={adaptSymbolPaint(signalDef.paint, paintContext)}
          />
        );
      })}
    </Source>
  );
};

export default GeoJSONs;
