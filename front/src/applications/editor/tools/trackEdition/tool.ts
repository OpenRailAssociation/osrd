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

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { GEOJSON_LAYER_ID } from '../../../../common/Map/Layers/GeoJSONs';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { TrackEditionLayers, TrackEditionLeftPanel } from './components';
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
          return state.editionState.type !== 'addPoint';
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
    }
  },
  onHover(e, { setState, state }) {
    if (!state.anchorLinePoints) {
      return;
    }

    if (e.features && e.features.length) {
      const nearestPoint = getNearestPoint(
        e.features as Feature<LineString | MultiLineString>[],
        e.lngLat
      );
      setState({ ...state, nearestPoint });
    } else {
      setState({ ...state, nearestPoint: null });
    }
  },
  onMove(_e, { state }) {
    if (state.editionState.type !== 'addPoint') {
      // TODO:
      // - Detect closest point of the new track
    }
  },

  getInteractiveLayers() {
    return [GEOJSON_LAYER_ID];
  },
  getCursor(_state, _editorState, { isDragging }) {
    if (isDragging) return 'move';
    return 'copy';
  },

  layersComponent: TrackEditionLayers,
  leftPanelComponent: TrackEditionLeftPanel,
};

export default TrackEditionTool;
