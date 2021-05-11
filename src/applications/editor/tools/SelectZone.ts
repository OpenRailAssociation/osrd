import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLeftCircle,
  BiSelection,
  FaDrawPolygon,
  MdPhotoSizeSelectSmall,
  TiTimesOutline,
} from 'react-icons/all';

import { Tool } from '../tools';
import { selectZone } from '../../../reducers/editor';

export interface SelectZoneState {
  mode: 'rectangle' | 'polygon';
  polygonPoints?: [number, number][];
  rectangleTopLeft?: [number, number];
}

export const SelectZone: Tool<SelectZoneState> = {
  // Zone selection:
  id: 'select-zone',
  icon: MdPhotoSizeSelectSmall,
  labelTranslationKey: 'Editor.tools.select-zone.label',
  descriptionTranslationKeys: [
    'Editor.tools.select-zone.description-1',
    'Editor.tools.select-zone.description-2',
    'Editor.tools.select-zone.description-3',
  ],
  getInitialState() {
    return {
      mode: 'rectangle',
    };
  },
  actions: [
    [
      {
        id: 'select-zone-rectangle',
        icon: BiSelection,
        labelTranslationKey: 'Editor.tools.select-zone.actions.rectangle.label',
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
        id: 'select-zone-polygon',
        icon: FaDrawPolygon,
        labelTranslationKey: 'Editor.tools.select-zone.actions.polygon.label',
        isActive(state) {
          return state.mode === 'polygon';
        },
        onClick({ setState }, state) {
          setState({
            ...state,
            mode: 'polygon',
            polygonPoints: [],
          });
        },
      },
    ],
    [
      {
        id: 'unselect-zone',
        icon: TiTimesOutline,
        labelTranslationKey: 'Editor.tools.select-zone.actions.unselect.label',
        onClick({ dispatch }) {
          dispatch<any>(selectZone(null));
        },
      },
    ],
    [
      {
        id: 'validate-polygon',
        icon: AiOutlineCheckCircle,
        labelTranslationKey: 'Editor.tools.select-zone.actions.validate-polygon.label',
        onClick({ dispatch, setState }, state) {
          if (state.polygonPoints) {
            dispatch<any>(selectZone({ type: 'polygon', points: state.polygonPoints }));
            setState({
              ...state,
              polygonPoints: [],
            });
          }
        },
        isDisabled(state) {
          return !state.polygonPoints || state.polygonPoints.length < 2;
        },
        isHidden(state) {
          return state.mode !== 'polygon';
        },
      },
      {
        id: 'cancel-last-point',
        icon: AiOutlineLeftCircle,
        labelTranslationKey: 'Editor.tools.select-zone.actions.cancel-last-point.label',
        onClick({ setState }, state) {
          if (state.polygonPoints) {
            setState({
              ...state,
              polygonPoints: state.polygonPoints.slice(0, -1),
            });
          }
        },
        isDisabled(state) {
          return !state.polygonPoints || !state.polygonPoints.length;
        },
        isHidden(state) {
          return state.mode !== 'polygon';
        },
      },
      {
        id: 'cancel-polygon',
        icon: AiOutlineCloseCircle,
        labelTranslationKey: 'Editor.tools.select-zone.actions.cancel-polygon.label',
        onClick({ setState }, state) {
          if (state.polygonPoints) {
            setState({
              ...state,
              polygonPoints: [],
            });
          }
        },
        isDisabled(state) {
          return !state.polygonPoints || !state.polygonPoints.length;
        },
        isHidden(state) {
          return state.mode !== 'polygon';
        },
      },
    ],
  ],
};
