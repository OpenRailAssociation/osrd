import { BiLoader, BiSelection, BsCursor, BsTrash, FaDrawPolygon, FiEdit } from 'react-icons/all';
import { isEqual } from 'lodash';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { save } from '../../../../reducers/editor';
import { selectInZone } from '../../../../utils/mapboxHelper';
import { SelectionState } from './types';
import { SelectionLayers, SelectionMessages, SelectionLeftPanel } from './components';
import ConfirmModal from '../../components/ConfirmModal';
import TrackEditionTool from '../trackEdition/tool';
import {
  BufferStopEntity,
  DetectorEntity,
  SignalEntity,
  SwitchEntity,
  TrackSectionEntity,
} from '../../../../types';
import { getSymbolsList } from '../../data/utils';
import {
  BufferStopEditionTool,
  DetectorEditionTool,
  SignalEditionTool,
} from '../pointEdition/tools';
import SwitchEditionTool from '../switchEdition/tool';

const SelectionTool: Tool<SelectionState> = {
  id: 'select-items',
  icon: BsCursor,
  labelTranslationKey: 'Editor.tools.select-items.label',
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
        labelTranslationKey: 'Editor.tools.select-items.actions.single',
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
        labelTranslationKey: 'Editor.tools.select-items.actions.rectangle',
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
        labelTranslationKey: 'Editor.tools.select-items.actions.polygon',
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
      {
        id: 'mode-edition',
        icon: FiEdit,
        labelTranslationKey: 'Editor.tools.select-items.actions.edit-info',
        isActive({ state }) {
          return state.selectionState.type === 'edition';
        },
        isDisabled({ state }) {
          const types = new Set<string>();
          state.selection.forEach((item) => types.add(item.objType));
          return types.size !== 1;
        },
        onClick({ setState, state, switchTool }) {
          if (state.selection.length === 1) {
            const selectedElement = state.selection[0];
            switch (selectedElement.objType) {
              case 'TrackSection':
                switchTool(TrackEditionTool, {
                  track: selectedElement as TrackSectionEntity,
                  editionState: {
                    type: 'movePoint',
                  },
                });
                return;
              case 'Signal':
                switchTool(SignalEditionTool, {
                  initialEntity: selectedElement as SignalEntity,
                  entity: selectedElement as SignalEntity,
                });
                return;
              case 'BufferStop':
                switchTool(BufferStopEditionTool, {
                  initialEntity: selectedElement as BufferStopEntity,
                  entity: selectedElement as BufferStopEntity,
                });
                return;
              case 'Detector':
                switchTool(DetectorEditionTool, {
                  initialEntity: selectedElement as DetectorEntity,
                  entity: selectedElement as DetectorEntity,
                });
                return;
              case 'Switch':
                switchTool(SwitchEditionTool, {
                  initialEntity: selectedElement as SwitchEntity,
                  entity: selectedElement as SwitchEntity,
                });
                return;
              default:
                return;
            }
          }

          if (state.selectionState.type !== 'edition')
            setState({
              ...state,
              selectionState: {
                type: 'edition',
                previousState: state.selectionState,
              },
            });
        },
      },
    ],
    // Selection actions:
    [
      {
        id: 'unselect-all',
        icon: BiLoader,
        labelTranslationKey: 'Editor.tools.select-items.actions.unselect-all',
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
        id: 'delete-selection',
        icon: BsTrash,
        labelTranslationKey: 'Editor.tools.select-items.actions.delete-selection',
        isDisabled({ state }) {
          return !state.selection.length;
        },
        onClick({ openModal, state, setState, dispatch, t }) {
          openModal({
            component: ConfirmModal,
            arguments: {
              title: t('Editor.tools.select-items.actions.delete-selection'),
              message: t('Editor.tools.select-items.actions.confirm-delete-selection'),
            },
            async afterSubmit() {
              await dispatch<ReturnType<typeof save>>(save({ delete: state.selection }));
              setState({ ...state, selection: [] });
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
    const isAlreadySelected = selection.find(
      (item) => item.properties.id === feature.properties.id
    );

    const current = editorState.entitiesIndex[feature.properties.id];

    if (current) {
      if (!isAlreadySelected) {
        if (e.srcEvent.ctrlKey) {
          selection = selection.concat([current]);
        } else {
          selection = [current];
        }
      } else if (e.srcEvent.ctrlKey) {
        selection = selection.filter((item) => item.properties.id !== feature.properties.id);
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
          setState({
            ...state,
            selectionState: { ...state.selectionState, rectangleTopLeft: null },
            selection: selectInZone(editorState.entitiesArray, {
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
            selection: selectInZone(editorState.entitiesArray, {
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
  getInteractiveLayers({ editorState: { flatEntitiesByTypes } }) {
    const symbolTypes = getSymbolsList(flatEntitiesByTypes.signals || []);
    return symbolTypes
      .map((type) => `editor/geo/signal-${type}`)
      .concat([
        'editor/geo/track-main',
        'editor/geo/buffer-stop-main',
        'editor/geo/detector-main',
        'editor/geo/switch-main',
      ]);
  },
  getCursor({ state }, { isDragging }) {
    if (isDragging) return 'move';
    if (state.selectionState.type === 'single' && state.hovered) return 'pointer';
    if (state.selectionState.type === 'rectangle' || state.selectionState.type === 'polygon')
      return 'crosshair';
    return 'default';
  },

  layersComponent: SelectionLayers,
  leftPanelComponent: SelectionLeftPanel,
  messagesComponent: SelectionMessages,
};

export default SelectionTool;
