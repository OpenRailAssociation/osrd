import React, { FC, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import { useTranslation } from 'react-i18next';
import { last } from 'lodash';

import { EditorContext } from '../../context';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import colors from '../../../../common/Map/Consts/colors';
import EditorZone from '../../../../common/Map/Layers/EditorZone';
import { TrackEditionState } from './types';
import EditorForm from '../../components/EditorForm';
import { save } from '../../../../reducers/editor';
import { CreateEntityOperation, Item, TrackSectionEntity } from '../../../../types';
import { EditorContextType, ExtendedEditorContextType } from '../types';
import { injectGeometry } from './utils';

export const TRACK_LAYER_ID = 'trackEditionTool/new-track-path';
export const POINTS_LAYER_ID = 'trackEditionTool/new-track-points';
const TRACK_COLOR = '#666';

export const TrackEditionLayers: FC = () => {
  const { state } = useContext(EditorContext) as EditorContextType<TrackEditionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  const isAddingPointOnExistingSection =
    typeof state.nearestPoint?.properties?.sectionIndex === 'number';
  const points = state.track.geometry.coordinates;
  let additionalSegment: typeof points = [];
  if (
    points.length &&
    state.editionState.type === 'addPoint' &&
    state.mousePosition &&
    !isAddingPointOnExistingSection
  ) {
    const lastPosition =
      state.anchorLinePoints &&
      state.nearestPoint &&
      typeof state.nearestPoint.properties?.sectionIndex !== 'number'
        ? (state.nearestPoint.geometry.coordinates as [number, number])
        : state.mousePosition;

    if (state.addNewPointsAtStart) {
      additionalSegment = [lastPosition, points[0]];
    } else {
      additionalSegment = [last(points) as [number, number], lastPosition];
    }
  }

  let highlightedPoint: [number, number] | undefined;
  if (state.editionState.type === 'movePoint') {
    if (typeof state.editionState.draggedPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.draggedPointIndex];
    } else if (typeof state.editionState.hoveredPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.hoveredPointIndex];
    }
  } else if (state.editionState.type === 'deletePoint') {
    if (typeof state.editionState.hoveredPointIndex === 'number') {
      highlightedPoint = state.track.geometry.coordinates[state.editionState.hoveredPointIndex];
    }
  }

  return (
    <>
      {/* Zone display */}
      <EditorZone />

      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={state.track.id ? [state.track as Item] : undefined}
      />

      {/* Track path */}
      <Source
        type="geojson"
        data={{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: points,
          },
        }}
      >
        <Layer
          id={TRACK_LAYER_ID}
          type="line"
          paint={{ 'line-color': TRACK_COLOR, 'line-dasharray': [2, 2] }}
        />
      </Source>
      {additionalSegment.length > 0 && (
        <Source
          type="geojson"
          data={{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: additionalSegment,
            },
          }}
        >
          <Layer type="line" paint={{ 'line-color': TRACK_COLOR, 'line-dasharray': [2, 2] }} />
        </Source>
      )}

      {/* Highlighted nearest point from data */}
      {state.editionState.type === 'addPoint' && state.nearestPoint && (
        <Source type="geojson" data={state.nearestPoint}>
          <Layer
            type="circle"
            paint={{
              'circle-radius': 4,
              'circle-color': '#fff',
              'circle-stroke-color': '#009EED',
              'circle-stroke-width': 1,
            }}
          />
        </Source>
      )}

      {/* Track points */}
      <Source
        type="geojson"
        data={{
          type: 'FeatureCollection',
          features: points.map((point, index) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: point,
            },
            properties: { index },
          })),
        }}
      >
        <Layer
          id={POINTS_LAYER_ID}
          type="circle"
          paint={{
            'circle-radius': state.editionState.type !== 'addPoint' ? 4 : 2,
            'circle-color': '#fff',
            'circle-stroke-color': TRACK_COLOR,
            'circle-stroke-width': 1,
          }}
        />
      </Source>

      {/* Highlighted nearest point or dragged point from track */}
      <Source
        type="geojson"
        data={{
          type: 'FeatureCollection',
          features: highlightedPoint
            ? [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Point',
                    coordinates: highlightedPoint,
                  },
                },
              ]
            : [],
        }}
      >
        <Layer
          type="circle"
          paint={{
            'circle-radius': 4,
            'circle-color': '#fff',
            'circle-stroke-color': TRACK_COLOR,
            'circle-stroke-width': 3,
          }}
        />
      </Source>
    </>
  );
};

export const TrackEditionLeftPanel: FC = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { state, setState, editorState } = useContext(
    EditorContext
  ) as ExtendedEditorContextType<TrackEditionState>;

  return (
    <EditorForm
      data={state.track}
      onSubmit={async (savedEntity) => {
        const res: any = await dispatch(
          save(
            state.track.id
              ? {
                  update: [
                    {
                      source: injectGeometry(editorState.entitiesIndex[state.track.id as string]),
                      target: injectGeometry(savedEntity),
                    },
                  ],
                }
              : { create: [injectGeometry(savedEntity)] }
          )
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const operation = res[0] as CreateEntityOperation;
        const { id } = operation.railjson;

        if (id && id !== savedEntity.id) setState({ ...state, track: { ...state.track, id } });
      }}
      onChange={(track) => {
        setState({ ...state, track: track as TrackSectionEntity });
      }}
    >
      <div className="text-right">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={state.track.geometry.coordinates.length < 2}
        >
          {t('common.save')}
        </button>
      </div>
    </EditorForm>
  );
};
