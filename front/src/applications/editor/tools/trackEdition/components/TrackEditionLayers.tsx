import { useContext } from 'react';

import type { Position } from 'geojson';
import { last } from 'lodash';
import { Layer, Source } from 'react-map-gl/maplibre';
import { useSelector } from 'react-redux';

import EditorContext from 'applications/editor/context';
import { POINTS_LAYER_ID, TRACK_LAYER_ID } from 'applications/editor/tools/trackEdition/consts';
import type { TrackEditionState } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/InfraObjectLayers/GeoJSONs';
import { useInfraID } from 'common/osrdContext';
import { getMap } from 'reducers/map/selectors';

export const TRACK_COLOR = '#666';
export const TRACK_STYLE = { 'line-color': TRACK_COLOR, 'line-dasharray': [2, 1], 'line-width': 2 };

const TrackEditionLayers = () => {
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<TrackEditionState>;
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);

  const infraID = useInfraID();

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

  let highlightedPoint: Position | undefined;
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
      {/* Editor data layer */}
      <GeoJSONs
        colors={colors[mapStyle]}
        hidden={state.track.properties.id ? [state.track.properties.id] : undefined}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
        infraID={infraID}
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
        <Layer id={TRACK_LAYER_ID} type="line" paint={TRACK_STYLE} />
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
          <Layer type="line" paint={TRACK_STYLE} />
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
              'circle-stroke-width': 2,
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

export default TrackEditionLayers;
