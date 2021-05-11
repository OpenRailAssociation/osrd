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

import { Tool } from '../tools';
import { Item } from '../../../types';
import { EditorState } from '../../../reducers/editor';

export interface SelectItemsState {
  mode: 'rectangle' | 'single' | 'lasso';
  selection: Item[];
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
            // TODO:
            // Read all items on screen from editorState, and get their layer and IDs
            selection: [],
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
          return state.mode === 'lasso';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'lasso',
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
            mode: 'lasso',
          });
        },
      },
    ],
  ],
};
