import {
  BiLoader,
  BiSelection,
  BsCursor,
  BsInfoSquare,
  BsTrash,
  FaDrawPolygon,
  FiEdit,
  MdSelectAll,
} from 'react-icons/all';
import { isEqual } from 'lodash';

import { Tool } from '../tools';
import { Item } from '../../../types';
import { EditorState } from '../../../reducers/editor';
import { selectInZone } from '../../../utils/mapboxHelper';

export interface SelectItemsState {
  mode: 'rectangle' | 'single' | 'polygon';
  selection: Item[];
  polygonPoints: [number, number][];
  rectangleTopLeft: [number, number] | null;
  showModal: 'info' | 'edit' | null;
}

export const SelectItems: Tool<SelectItemsState> = {
  id: 'select-item',
  icon: BsCursor,
  labelTranslationKey: 'Editor.tools.select-item.label',
  descriptionTranslationKeys: ['Editor.tools.select-item.description-1'],
  isDisabled(editorState: EditorState) {
    return !editorState.editionZone;
  },
  getInitialState() {
    return {
      mode: 'single',
      selection: [],
      polygonPoints: [],
      rectangleTopLeft: null,
      showModal: null,
    };
  },
  actions: [
    [
      {
        id: 'select-all',
        icon: MdSelectAll,
        labelTranslationKey: 'Editor.tools.select-items.actions.select-all.label',
        onClick({ setState }, state, editorState) {
          setState({
            ...state,
            selection: selectInZone(editorState.editionData || []),
          });
        },
      },
      {
        id: 'unselect-all',
        icon: BiLoader,
        labelTranslationKey: 'Editor.tools.select-items.actions.unselect-all.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            selection: [],
          });
        },
      },
      {
        id: 'show-info',
        icon: BsInfoSquare,
        labelTranslationKey: 'Editor.tools.select-items.actions.show-info.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            showModal: 'info',
          });
        },
      },
      {
        id: 'edit-info',
        icon: FiEdit,
        labelTranslationKey: 'Editor.tools.select-items.actions.edit-info.label',
        isDisabled(state) {
          return state.selection.length !== 1;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            showModal: 'edit',
          });
        },
      },
    ],
    [
      {
        id: 'mode-single',
        icon: BsCursor,
        labelTranslationKey: 'Editor.tools.select-items.actions.single.label',
        isActive(state) {
          return state.mode === 'single';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'single',
          });
        },
      },
      {
        id: 'mode-rectangle',
        icon: BiSelection,
        labelTranslationKey: 'Editor.tools.select-items.actions.rectangle.label',
        isActive(state) {
          return state.mode === 'rectangle';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'rectangle',
          });
        },
      },
      {
        id: 'mode-lasso',
        icon: FaDrawPolygon,
        labelTranslationKey: 'Editor.tools.select-items.actions.lasso.label',
        isActive(state) {
          return state.mode === 'polygon';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'polygon',
          });
        },
      },
      {
        id: 'delete-selection',
        icon: BsTrash,
        labelTranslationKey: 'Editor.tools.select-items.actions.delete-selection.label',
        isDisabled(state) {
          return !state.selection.length;
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'polygon',
          });
        },
      },
    ],
  ],

  // Interactions:
  onClickFeature(feature, e, { setState }, toolState) {
    if (toolState.mode !== 'single') return;

    let selection: Item[] = toolState.selection;
    const isAlreadySelected = selection.find(
      (item) => item.layer === feature.layer && item.id === feature.id
    );

    if (!isAlreadySelected) {
      if (e.srcEvent.ctrlKey) {
        selection = selection.concat([feature]);
      } else {
        selection = [feature];
      }
    } else {
      if (e.srcEvent.ctrlKey) {
        selection = selection.filter(
          (item) => !(item.layer === feature.layer && item.id === feature.id)
        );
      } else if (selection.length === 1) {
        selection = [];
      } else {
        selection = [feature];
      }
    }

    setState({
      ...toolState,
      selection,
    });
  },
  onClickMap(e, { setState }, toolState, editorState) {
    const position = e.lngLat;

    if (toolState.mode === 'rectangle') {
      if (toolState.rectangleTopLeft) {
        if (isEqual(toolState.rectangleTopLeft, position)) {
          setState({ ...toolState, rectangleTopLeft: null });
        } else {
          setState({
            ...toolState,
            rectangleTopLeft: null,
            selection: selectInZone(editorState.editionData || [], {
              type: 'rectangle',
              points: [toolState.rectangleTopLeft, position],
            }),
          });
        }
      } else {
        setState({
          ...toolState,
          rectangleTopLeft: position,
        });
      }
    } else if (toolState.mode === 'polygon') {
      const points = toolState.polygonPoints;
      const lastPoint = points[points.length - 1];

      if (isEqual(lastPoint, position)) {
        if (points.length >= 3) {
          setState({
            ...toolState,
            polygonPoints: [],
            selection: selectInZone(editorState.editionData || [], {
              type: 'polygon',
              points: points,
            }),
          });
        }
      } else {
        setState({ ...toolState, polygonPoints: points.concat([position]) });
      }
    }
  },
};
