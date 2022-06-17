import { cloneDeep, isEqual } from 'lodash';
import {
  BiAnchor,
  BiTrash,
  CgAdd,
  MdShowChart,
  RiDragMoveLine,
  TiDeleteOutline,
} from 'react-icons/all';
import { Feature, LineString, MultiLineString } from 'geojson';
import nearestPoint from '@turf/nearest-point';
import { featureCollection } from '@turf/helpers';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { GEOJSON_LAYER_ID } from '../../../../common/Map/Layers/GeoJSONs';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { POINTS_LAYER_ID, TrackEditionLayers, TrackEditionLeftPanel } from './components';
import { TrackEditionState } from './types';
import { getNewLine } from './utils';

const TrackEditionTool: Tool<TrackEditionState> = {
  // Zone selection:
  id: 'create-line',
  icon: MdShowChart,
  labelTranslationKey: 'Editor.tools.create-line.label',
  descriptionTranslationKeys: [
    'Editor.tools.create-line.description-1',
    'Editor.tools.create-line.description-2',
    'Editor.tools.create-line.description-3',
    'Editor.tools.create-line.description-4',
    'Editor.tools.create-line.description-5',
  ],
  isDisabled({ editorState }) {
    return !editorState.editorZone;
  },
  getRadius() {
    return 50;
  },
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      anchorLinePoints: true,
      nearestPoint: null,
      track: getNewLine([]),
      editionState: {
        type: 'addPoint',
        addAtStart: false,
      },
    };
  },
  actions: [
    [
      {
        id: 'mode-move-point',
        icon: RiDragMoveLine,
        labelTranslationKey: 'Editor.tools.create-line.actions.mode-move-point.label',
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
        labelTranslationKey: 'Editor.tools.create-line.actions.mode-add-point.label',
        onClick({ setState, state }) {
          setState({
            ...state,
            editionState: {
              type: 'addPoint',
              addAtStart: false,
            },
          });
        },
        isActive({ state }) {
          return state.editionState.type === 'addPoint';
        },
      },
      {
        id: 'mode-delete-point',
        icon: TiDeleteOutline,
        labelTranslationKey: 'Editor.tools.create-line.actions.mode-delete-point.label',
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
        labelTranslationKey: 'Editor.tools.create-line.actions.toggle-anchoring.label',
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
        id: 'cancel-line',
        icon: BiTrash,
        labelTranslationKey: 'Editor.tools.create-line.actions.cancel-line.label',
        onClick({ setState, state }) {
          if (state.track.geometry.coordinates.length) {
            const newState = cloneDeep(state);
            newState.track.geometry.coordinates = [];
            setState(newState);
          }
        },
        isDisabled({ state }) {
          return state.editionState.type !== 'addPoint' || !state.track.geometry.coordinates.length;
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(e, { setState, state }) {
    if (state.editionState.type === 'addPoint') {
      const position: [number, number] =
        state.anchorLinePoints && state.nearestPoint
          ? (state.nearestPoint.geometry.coordinates as [number, number])
          : e.lngLat;

      const points = state.track.geometry.coordinates;
      const lastPoint = points[points.length - 1];

      if (!isEqual(lastPoint, position)) {
        const newState = cloneDeep(state);
        if (state.editionState.addAtStart) {
          newState.track.geometry.coordinates.unshift(position);
        } else {
          newState.track.geometry.coordinates.push(position);
        }
        setState(newState);
      }
    } else if (state.editionState.type === 'movePoint') {
      if (typeof state.editionState.draggedPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            draggedPointIndex: undefined,
          },
        });
      } else if (typeof state.editionState.hoveredPointIndex === 'number') {
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            draggedPointIndex: state.editionState.hoveredPointIndex,
            hoveredPointIndex: undefined,
          },
        });
      }
    } else if (
      state.editionState.type === 'deletePoint' &&
      typeof state.editionState.hoveredPointIndex === 'number'
    ) {
      const newState = cloneDeep(state);
      newState.editionState = { type: 'deletePoint' };
      newState.track.geometry.coordinates.splice(state.editionState.hoveredPointIndex, 1);
      setState(newState);
    }
  },
  onHover(e, { setState, state }) {
    if (state.editionState.type !== 'deletePoint' && state.anchorLinePoints) {
      const dataFeatures = (e.features || []).filter((f) => f.layer.id === GEOJSON_LAYER_ID);

      setState({
        ...state,
        nearestPoint: dataFeatures.length
          ? getNearestPoint(dataFeatures as Feature<LineString | MultiLineString>[], e.lngLat)
          : null,
      });
    }

    if (
      (state.editionState.type === 'movePoint' &&
        typeof state.editionState.draggedPointIndex !== 'number') ||
      state.editionState.type === 'deletePoint'
    ) {
      const pointFeatures = (e.features || []).filter((f) => f.layer.id === POINTS_LAYER_ID);

      if (!pointFeatures.length) {
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            hoveredPointIndex: undefined,
          },
        });
      } else {
        const nearest = nearestPoint(e.lngLat, featureCollection(pointFeatures));
        setState({
          ...state,
          editionState: {
            ...state.editionState,
            hoveredPointIndex: nearest.properties.index as number,
          },
        });
      }
    }
  },
  onMove(e, { state, setState }) {
    if (
      state.editionState.type === 'movePoint' &&
      typeof state.editionState.draggedPointIndex === 'number'
    ) {
      const track = cloneDeep(state.track);
      track.geometry.coordinates[state.editionState.draggedPointIndex] =
        state.anchorLinePoints && state.nearestPoint
          ? (state.nearestPoint.geometry.coordinates as [number, number])
          : e.lngLat;

      setState({
        ...state,
        track,
      });
    }
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
    return [GEOJSON_LAYER_ID, POINTS_LAYER_ID];
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
};

export default TrackEditionTool;
