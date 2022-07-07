import { keyBy } from 'lodash';
import { useSelector } from 'react-redux';
import React, { FC, useMemo } from 'react';
import { FeatureCollection } from 'geojson';
import { Layer, Source } from 'react-map-gl';

import { Item, Theme } from '../../../types';
import { clippedDataSelector, EditorState } from '../../../reducers/editor';
import { geoMainLayer } from './geographiclayers';
import {
  getPointLayerProps,
  getSignalLayerProps,
  getSignalMatLayerProps,
  SignalContext,
  SignalsSettings,
} from './geoSignalsLayers';

const HOVERED_COLOR = '#009EED';
const SELECTED_COLOR = '#0c6b9a';
const SIGNAL_TYPE_KEY = 'installation_type';

export const GEOJSON_LAYER_ID = 'editor/geo-main-layer';

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

  const geojson = useMemo(() => {
    const hiddenIndex = keyBy(hidden || [], 'id');
    const hoveredIndex = keyBy(hovered || [], 'id');
    const selectionIndex = keyBy(selection || [], 'id');
    return {
      type: 'FeatureCollection',
      features: editorData.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          ...(selectionIndex[feature.properties?.id] ? { selected: true } : {}),
          ...(hoveredIndex[feature.properties?.id] ? { hovered: true } : {}),
          ...(hiddenIndex[feature.properties?.id] ? { hidden: true } : {}),
        },
      })),
    } as FeatureCollection;
  }, [editorData, hidden, hovered, selection]);

  // SIGNALS:
  const signalsList = useMemo(
    () =>
      Object.keys(
        editorData.reduce(
          (iter, feature) =>
            feature.objType === 'Signal' && (feature.properties || {})[SIGNAL_TYPE_KEY]
              ? { ...iter, [(feature.properties || {})[SIGNAL_TYPE_KEY]]: true }
              : iter,
          {}
        )
      ).map((type) => type.replace(/(^[" ]|[" ]$)/g, '')),
    [editorData]
  );
  const prefix = mapStyle === 'blueprint' ? 'SCHB ' : '';
  const context: SignalContext = useMemo(
    () => ({
      prefix,
      colors,
      signalsList,
      sourceLayer: 'geo',
    }),
    [colors, prefix, signalsList]
  );
  const propsPerType = useMemo(
    () =>
      signalsList.reduce(
        (iter, type) => ({
          ...iter,
          [type]: getSignalLayerProps(context, type),
        }),
        {}
      ),
    [context, signalsList]
  );
  const hoveredIDs = useMemo(() => (hovered || []).map((item) => item.id), [hovered]);

  return (
    <Source id="editor/geo" type="geojson" data={geojson}>
      <Layer {...geoMainLayer(colors)} id={GEOJSON_LAYER_ID} filter={['!=', 'hidden', true]} />
      <Layer
        type="line"
        paint={{ 'line-color': HOVERED_COLOR, 'line-width': 3 }}
        filter={['==', 'hovered', true]}
      />
      <Layer
        type="line"
        paint={{ 'line-color': SELECTED_COLOR, 'line-width': 3 }}
        filter={['==', 'selected', true]}
      />

      {/* Point objects */}
      <Layer {...getSignalMatLayerProps(context)} id="editor/geo-signal/mat" />
      <Layer {...getPointLayerProps(context)} id="editor/geo-signal/point" />
      {signalsList.map((type) => {
        const layerId = `editor/geo-signals/${type}`;
        const signalDef = propsPerType[type];
        const opacity = (signalDef.paint || {})['icon-opacity'] || 1;

        return (
          <Layer
            key={type}
            {...signalDef}
            id={layerId}
            filter={['==', SIGNAL_TYPE_KEY, `"${type}"`]}
            paint={{
              ...signalDef.paint,
              'icon-opacity': hoveredIDs.length
                ? ['case', ['in', 'id', ['literal', hoveredIDs]], opacity * 0.6, opacity]
                : opacity,
            }}
          />
        );
      })}
    </Source>
  );
};

export default GeoJSONs;
