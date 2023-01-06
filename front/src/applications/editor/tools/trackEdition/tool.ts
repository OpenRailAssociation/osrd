import { cloneDeep, isEmpty, isEqual } from 'lodash';
import {
  BiAnchor,
  BiArrowFromLeft,
  BiArrowToRight,
  BiTrash,
  CgAdd,
  MdShowChart,
  RiDragMoveLine,
  TiDeleteOutline,
} from 'react-icons/all';
import { Feature, LineString } from 'geojson';
import nearestPointOnLine, { NearestPointOnLine } from '@turf/nearest-point-on-line';
import getNearestPoint from '@turf/nearest-point';
import { featureCollection } from '@turf/helpers';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { getMapMouseEventNearestFeature } from '../../../../utils/mapboxHelper';
import {
  POINTS_LAYER_ID,
  TRACK_LAYER_ID,
  TrackEditionLayers,
  TrackEditionLeftPanel,
  TrackEditionMessages,
} from './components';
import { TrackEditionState } from './types';
import { getNewLine } from './utils';
import { entityDoUpdate } from '../../components/LinearMetadata';

const TrackEditionTool: Tool<TrackEditionState> = {
  id: 'track-edition',
  icon: MdShowChart,
  labelTranslationKey: 'Editor.tools.track-edition.label',
  requiredLayers: new Set(['track_sections']),
  isDisabled({ editorState }) {
    return !editorState.editorLayers.has('track_sections');
  },
  getInitialState() {
    const track = getNewLine([]);

    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      anchorLinePoints: true,
      addNewPointsAtStart: false,
      nearestPoint: null,
      track,
      initialTrack: track,
      editionState: { type: 'addPoint' },
    };
  },
  actions: [
    [
      {
        id: 'mode-move-point',
        icon: RiDragMoveLine,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-move-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: {
              type: 'movePoint',
            },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'movePoint';
        },
      },
      {
        id: 'mode-add-point',
        icon: CgAdd,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-add-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: { type: 'addPoint' },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'addPoint';
        },
      },
      {
        id: 'mode-delete-point',
        icon: TiDeleteOutline,
        labelTranslationKey: 'Editor.tools.track-edition.actions.mode-delete-point',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: {
              type: 'deletePoint',
            },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'deletePoint';
        },
      },
    ],
    [
      {
        id: 'toggle-anchoring',
        icon: BiAnchor,
        labelTranslationKey: 'Editor.tools.track-edition.actions.toggle-anchoring',
        onClick({ setState, state }) {
          setState({
            ...state,
            anchorLinePoints: !state.anchorLinePoints,
            nearestPoint: null,
          });
        },
        isActive({ state }) {
          return state.anchorLinePoints;
        },
        isDisabled({ state }) {
          return state.editionState.type === 'deletePoint';
        },
      },
      {
        id: 'add-at-start',
        icon: BiArrowFromLeft,
        labelTranslationKey: 'Editor.tools.track-edition.actions.add-at-start',
        onClick({ setState, state }) {
          setState({
            ...state,
            addNewPointsAtStart: true,
          });
        },
        isHidden({ state }) {
          return state.editionState.type !== 'addPoint' || state.addNewPointsAtStart;
        },
      },
      {
        id: 'add-at-end',
        icon: BiArrowToRight,
        labelTranslationKey: 'Editor.tools.track-edition.actions.add-at-end',
        onClick({ setState, state }) {
          setState({
            ...state,
            addNewPointsAtStart: false,
          });
        },
        isHidden({ state }) {
          return state.editionState.type !== 'addPoint' || !state.addNewPointsAtStart;
        },
      },
      {
        id: 'cancel-line',
        icon: BiTrash,
        labelTranslationKey: 'Editor.tools.track-edition.actions.cancel-line',
        onClick({ setState, state }) {
          if (state.track.geometry.coordinates.length) {
            const newState = cloneDeep(state);
            newState.track.geometry.coordinates = [];
            setState(newState);
          }
        },
        isDisabled({ state }) {
          return !state.track.geometry.coordinates.length;
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(e, { setState, state }) {
    const { editionState, anchorLinePoints, track, nearestPoint } = state;

    if (editionState.type === 'addPoint') {
      // Adding a point on an existing section:
      if (
        anchorLinePoints &&
        nearestPoint &&
        typeof nearestPoint.properties?.sectionIndex === 'number'
      ) {
        const position = nearestPoint.geometry.coordinates as [number, number];
        const index = nearestPoint.properties.sectionIndex;
        const newState = cloneDeep(state);

        newState.track.geometry.coordinates.splice(index + 1, 0, position);
        newState.track = entityDoUpdate(newState.track, state.track.geometry);
        newState.nearestPoint = null;
        setState(newState);
      }
      // Adding a new point at the extremity of the track:
      else {
        const position = (
          anchorLinePoints && nearestPoint ? nearestPoint.geometry.coordinates : e.lngLat.toArray()
        ) as [number, number];

        const points = track.geometry.coordinates;
        const lastPoint = points[points.length - 1];

        if (!isEqual(lastPoint, position)) {
          const newState = cloneDeep(state);
          if (state.addNewPointsAtStart) {
            newState.track.geometry.coordinates.unshift(position);
          } else {
            newState.track.geometry.coordinates.push(position);
          }

          newState.nearestPoint = null;
          setState(newState);
        } else {
          setState({
            ...state,
            editionState: {
              type: 'movePoint',
            },
          });
        }
      }
    } else if (editionState.type === 'movePoint') {
      if (typeof editionState.draggedPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...editionState,
            draggedPointIndex: undefined,
          },
        });
      } else if (typeof editionState.hoveredPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...editionState,
            draggedPointIndex: editionState.hoveredPointIndex,
            hoveredPointIndex: undefined,
          },
        });
      }
    } else if (
      editionState.type === 'deletePoint' &&
      typeof editionState.hoveredPointIndex === 'number'
    ) {
      const newState = cloneDeep(state);
      newState.editionState = { type: 'deletePoint' };
      newState.track.geometry.coordinates.splice(editionState.hoveredPointIndex, 1);
      newState.track = entityDoUpdate(newState.track, state.track.geometry);
      setState(newState);
    }
  },
  onMove(e, { setState, state }) {
    const { editionState, track, anchorLinePoints, nearestPoint } = state;
    const newState: Partial<TrackEditionState> = {};
    const coordinates = e.lngLat.toArray();

    if (editionState.type === 'addPoint' && anchorLinePoints) {
      if (track.geometry.coordinates.length > 1) {
        const closest = nearestPointOnLine(track.geometry, coordinates);
        const closestPosition = closest.geometry.coordinates;

        if (track.geometry.coordinates.every((point) => !isEqual(point, closestPosition))) {
          closest.properties = {
            sectionIndex: closest.properties.index,
          };
          newState.nearestPoint = closest;
        }
      }
    }

    if (anchorLinePoints && !newState.nearestPoint) {
      const candidates: NearestPointOnLine[] = [];

      const closestTrack = getMapMouseEventNearestFeature(e, {
        layersId: ['editor/geo/track-main'],
        tolerance: 50,
      })?.feature;
      if (closestTrack) {
        candidates.push(
          nearestPointOnLine(closestTrack as Feature<LineString>, e.lngLat.toArray())
        );
      }
      if (newState.nearestPoint) {
        candidates.push(newState.nearestPoint);
      }

      if (candidates.length === 1) {
        // eslint-disable-next-line prefer-destructuring
        newState.nearestPoint = candidates[0];
      } else if (candidates.length > 1) {
        newState.nearestPoint = getNearestPoint(e.lngLat.toArray(), featureCollection(candidates));
      } else if (nearestPoint) {
        newState.nearestPoint = null;
      }
    }

    if (
      (editionState.type === 'movePoint' && typeof editionState.draggedPointIndex !== 'number') ||
      editionState.type === 'deletePoint'
    ) {
      const point = getMapMouseEventNearestFeature(e, {
        layersId: [POINTS_LAYER_ID],
      });

      if (!point && typeof editionState.hoveredPointIndex === 'number') {
        newState.editionState = {
          ...editionState,
          hoveredPointIndex: undefined,
        };
      } else if (point && typeof editionState.hoveredPointIndex !== 'number') {
        newState.editionState = {
          ...editionState,
          hoveredPointIndex: point.feature.properties?.index as number,
        };
      }
    }

    if (editionState.type === 'movePoint' && typeof editionState.draggedPointIndex === 'number') {
      const newTrack = cloneDeep(track);
      newTrack.geometry.coordinates[editionState.draggedPointIndex] = (
        anchorLinePoints && nearestPoint ? nearestPoint.geometry.coordinates : e.lngLat.toArray()
      ) as [number, number];

      newState.track = entityDoUpdate(newTrack, track.geometry);
    }

    if (!isEmpty(newState)) setState(newState);
  },
  onKeyDown(e, { state, setState }) {
    if (e.key === 'Escape') {
      if (state.editionState.type === 'addPoint') {
        setState({ ...state, editionState: { type: 'movePoint' } });
      }

      if (
        state.editionState.type === 'movePoint' &&
        typeof state.editionState.draggedPointIndex === 'number'
      ) {
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            draggedPointIndex: undefined,
          },
        });
      }
    }
  },

  getInteractiveLayers() {
    return ['editor/geo/track-main', POINTS_LAYER_ID, TRACK_LAYER_ID];
  },

  getCursor({ state }, { isDragging }) {
    if (isDragging) return 'move';
    if (state.editionState.type === 'addPoint') return 'copy';
    if (state.editionState.type === 'movePoint') {
      if (typeof state.editionState.draggedPointIndex === 'number') return 'move';
      if (typeof state.editionState.hoveredPointIndex === 'number') return 'pointer';
    }
    if (state.editionState.type === 'deletePoint') {
      if (typeof state.editionState.hoveredPointIndex === 'number') return 'pointer';
    }
    return 'default';
  },

  layersComponent: TrackEditionLayers,
  leftPanelComponent: TrackEditionLeftPanel,
  messagesComponent: TrackEditionMessages,
};

export default TrackEditionTool;
