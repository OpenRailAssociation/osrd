import { BiLoader, BiSelection, BsCursor, BsTrash, FaDrawPolygon, FiEdit } from 'react-icons/all';
import { isEqual } from 'lodash';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { save } from '../../../../reducers/editor';
import { selectInZone } from '../../../../utils/mapboxHelper';
import { GEOJSON_LAYER_ID } from '../../../../common/Map/Layers/GeoJSONs';
import { SelectionState } from './types';
import { SelectionLayers, SelectionMessages } from './components';
import ConfirmModal from '../../components/ConfirmModal';
import EditorModal from '../../components/EditorModal';

const SelectionTool: Tool<SelectionState> = {
  id: 'select-items',
  icon: BsCursor,
  labelTranslationKey: 'Editor.tools.select-items.label',
  descriptionTranslationKeys: ['Editor.tools.select-items.description-1'],
  isDisabled(context) {
    return !context.editorState.editorZone;
  },
  getInitialState() {
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      selectionState: { type: 'single' },
      selection: [],
      showModal: null,
    };
  },
  actions: [
    // Different selection modes:
    [
      {
        id: 'mode-single',
        icon: BsCursor,
        labelTranslationKey: 'Editor.tools.select-items.actions.single.label',
        isActive({ state }) {
          return state.selectionState.type === 'single';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'single' },
          });
        },
      },
      {
        id: 'mode-rectangle',
        icon: BiSelection,
        labelTranslationKey: 'Editor.tools.select-items.actions.rectangle.label',
        isActive({ state }) {
          return state.selectionState.type === 'rectangle';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'rectangle', rectangleTopLeft: null },
          });
        },
      },
      {
        id: 'mode-polygon',
        icon: FaDrawPolygon,
        labelTranslationKey: 'Editor.tools.select-items.actions.polygon.label',
        isActive({ state }) {
          return state.selectionState.type === 'polygon';
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selectionState: { type: 'polygon', polygonPoints: [] },
          });
        },
      },
    ],
    // Selection actions:
    [
      {
        id: 'unselect-all',
        icon: BiLoader,
        labelTranslationKey: 'Editor.tools.select-items.actions.unselect-all.label',
        isDisabled({ state }) {
          return !state.selection.length;
        },
        onClick({ setState, state }) {
          setState({
            ...state,
            selection: [],
          });
        },
      },
      {
        id: 'edit-info',
        icon: FiEdit,
        labelTranslationKey: 'Editor.tools.select-items.actions.edit-info.label',
        isDisabled({ state }) {
          return state.selection.length !== 1;
        },
        onClick({ setState, state, openModal, dispatch }) {
          openModal({
            component: EditorModal,
            arguments: {
              entity: state.selection[0],
            },
            async afterSubmit({ savedEntity }) {
              await dispatch<any>(save({ update: [savedEntity] }));
              setState({ ...state, selection: [savedEntity] });
            },
          });
        },
      },
      {
        id: 'delete-selection',
        icon: BsTrash,
        labelTranslationKey: 'Editor.tools.select-items.actions.delete-selection.label',
        isDisabled({ state }) {
          return !state.selection.length;
        },
        onClick({ openModal, state, t }) {
          openModal({
            component: ConfirmModal,
            arguments: {
              title: t('Editor.tools.select-items.actions.delete-selection.label'),
              message: t('Editor.tools.select-items.actions.delete-selection.confirmation'),
            },
            afterSubmit() {
              save({ delete: state.selection });
            },
          });
        },
      },
    ],
  ],

  // Interactions:
  onClickFeature(feature, e, { setState, state, editorState }) {
    if (state.selectionState.type !== 'single') return;

    let { selection } = state;
    const isAlreadySelected = selection.find((item) => item.id === feature.id);

    const current = editorState.editorData.find((item) => item.id === feature.id);
    if (current) {
      if (!isAlreadySelected) {
        if (e.srcEvent.ctrlKey) {
          selection = selection.concat([current]);
        } else {
          selection = [current];
        }
      } else if (e.srcEvent.ctrlKey) {
        selection = selection.filter((item) => item.id !== feature.id);
      } else if (selection.length === 1) {
        selection = [];
      } else {
        selection = [current];
      }
    }

    setState({
      ...state,
      selection,
    });
  },
  onClickMap(e, { setState, state, editorState }) {
    const position = e.lngLat;

    if (state.selectionState.type === 'rectangle') {
      if (state.selectionState.rectangleTopLeft) {
        if (isEqual(state.selectionState.rectangleTopLeft, position)) {
          setState({
            ...state,
            selectionState: { ...state.selectionState, rectangleTopLeft: null },
          });
        } else {
          // TODO remove the layer static variable
          setState({
            ...state,
            selectionState: { ...state.selectionState, rectangleTopLeft: null },
            selection: selectInZone(editorState.editorData, {
              type: 'rectangle',
              points: [state.selectionState.rectangleTopLeft, position],
            }),
          });
        }
      } else {
        setState({
          ...state,
          selectionState: { ...state.selectionState, rectangleTopLeft: position },
        });
      }
    } else if (state.selectionState.type === 'polygon') {
      const points = state.selectionState.polygonPoints;
      const lastPoint = points[points.length - 1];

      if (isEqual(lastPoint, position)) {
        if (points.length >= 3) {
          // TODO remove the layer static variable
          setState({
            ...state,
            selectionState: {
              ...state.selectionState,
              polygonPoints: [],
            },
            selection: selectInZone(editorState.editorData, {
              type: 'polygon',
              points,
            }),
          });
        }
      } else {
        setState({
          ...state,
          selectionState: {
            ...state.selectionState,
            polygonPoints: points.concat([position]),
          },
        });
      }
    }
  },

  // Layers:
  getInteractiveLayers() {
    return [GEOJSON_LAYER_ID];
  },
  getCursor(toolState, _editorState, { isDragging }) {
    if (isDragging) return 'move';
    if (toolState.selectionState.type === 'single' && toolState.hovered) return 'pointer';
    if (toolState.selectionState.type !== 'single') return 'crosshair';
    return 'default';
  },

  messagesComponent: SelectionMessages,
  layersComponent: SelectionLayers,
};

export default SelectionTool;
