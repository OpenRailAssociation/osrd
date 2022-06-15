import { isEqual } from 'lodash';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLeftCircle,
  BiAnchor,
  MdShowChart,
} from 'react-icons/all';
import { Feature, LineString, MultiLineString } from 'geojson';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { save } from '../../../../reducers/editor';
import { GEOJSON_LAYER_ID } from '../../../../common/Map/Layers/GeoJSONs';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { LineCreationLayers } from './components';
import { LineCreationState } from './types';
import EditorModal from '../../components/EditorModal';
import { getNewLine } from './utils';

export const LineCreationTool: Tool<LineCreationState> = {
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
      linePoints: [],
      anchorLinePoints: true,
      nearestPoint: null,
    };
  },
  actions: [
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
      },
    ],
    [
      {
        id: 'validate-line',
        icon: AiOutlineCheckCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.validate-line.label',
        onClick({ setState, state, openModal, dispatch }) {
          if (state.linePoints) {
            openModal({
              component: EditorModal,
              arguments: {
                entity: getNewLine(state.linePoints),
              },
              async afterSubmit({ savedEntity }) {
                await dispatch<any>(save({ create: [savedEntity] }));
                setState({ ...state, linePoints: [] });
              },
            });
          }
        },
        isDisabled({ state }) {
          return !state.linePoints || state.linePoints.length < 2;
        },
      },
      {
        id: 'cancel-last-point',
        icon: AiOutlineLeftCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.cancel-last-point.label',
        onClick({ setState, state }) {
          if (state.linePoints) {
            setState({
              ...state,
              linePoints: state.linePoints.slice(0, -1),
            });
          }
        },
        isDisabled({ state }) {
          return !state.linePoints.length;
        },
      },
      {
        id: 'cancel-line',
        icon: AiOutlineCloseCircle,
        labelTranslationKey: 'Editor.tools.create-line.actions.cancel-line.label',
        onClick({ setState, state }) {
          if (state.linePoints) {
            setState({
              ...state,
              linePoints: [],
            });
          }
        },
        isDisabled({ state }) {
          return !state.linePoints.length;
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(e, { setState, state, openModal, dispatch }) {
    const position: [number, number] =
      state.anchorLinePoints && state.nearestPoint
        ? (state.nearestPoint.geometry.coordinates as [number, number])
        : e.lngLat;

    const points = state.linePoints;
    const lastPoint = points[points.length - 1];

    if (isEqual(lastPoint, position)) {
      if (points.length >= 3) {
        openModal({
          component: EditorModal,
          arguments: {
            entity: getNewLine(state.linePoints),
          },
          async afterSubmit({ savedEntity }) {
            await dispatch<any>(save({ create: [savedEntity] }));
            setState({ ...state, linePoints: [] });
          },
        });
      }
    } else {
      setState({ ...state, linePoints: points.concat([position]) });
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

  // Display:
  layersComponent: LineCreationLayers,
  getInteractiveLayers() {
    return [GEOJSON_LAYER_ID];
  },
  getCursor(_state, _editorState, { isDragging }) {
    if (isDragging) return 'move';
    return 'copy';
  },
};
