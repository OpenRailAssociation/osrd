import React from 'react';
import {
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
  AiOutlineLeftCircle,
  BiSelection,
  FaDrawPolygon,
  MdPhotoSizeSelectSmall,
  TiTimesOutline,
} from 'react-icons/all';
import { MapEvent } from 'react-map-gl';
import { isEqual } from 'lodash';

import { CommonToolState, DEFAULT_COMMON_TOOL_STATE, Tool } from '../tools';
import { Zone } from '../../../types';
import { selectZone } from '../../../reducers/editor';
import EditorZone from '../../../common/Map/Layers/EditorZone';
import TracksGeographic from '../../../common/Map/Layers/TracksGeographic';
import colors from '../../../common/Map/Consts/colors';

export type SelectZoneState = CommonToolState & {
  mode: 'rectangle' | 'polygon';
  polygonPoints: [number, number][];
  rectangleTopLeft: [number, number] | null;
};

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
      ...DEFAULT_COMMON_TOOL_STATE,
      mode: 'rectangle',
      polygonPoints: [],
      rectangleTopLeft: null,
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
            rectangleTopLeft: null,
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
        isDisabled(state, editorState) {
          return !editorState.editionZone;
        },
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

  // Interactions:
  onClickMap(e: MapEvent, { setState, dispatch }, toolState) {
    const position = e.lngLat;

    if (toolState.mode === 'rectangle') {
      if (toolState.rectangleTopLeft) {
        if (isEqual(toolState.rectangleTopLeft, position)) {
          setState({ ...toolState, rectangleTopLeft: null });
        } else {
          dispatch<any>(
            selectZone({ type: 'rectangle', points: [toolState.rectangleTopLeft, position] })
          );
          setState({ ...toolState, rectangleTopLeft: null });
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
          dispatch<any>(selectZone({ type: 'polygon', points: points }));
          setState({ ...toolState, polygonPoints: [] });
        }
      } else {
        setState({ ...toolState, polygonPoints: points.concat([position]) });
      }
    }
  },
  onHover() {
    // Nothing here (to prevent the default Map to update the `hovered` state for no purpose)
  },

  // Layers:
  getLayers({ mapStyle }, toolState, editorState) {
    let newZone: Zone | undefined;

    if (toolState.mode === 'rectangle' && toolState.rectangleTopLeft) {
      newZone = {
        type: 'rectangle',
        points: [toolState.rectangleTopLeft, toolState.mousePosition],
      };
    }

    if (toolState.mode === 'polygon' && toolState.polygonPoints.length) {
      newZone = {
        type: 'polygon',
        points: [...toolState.polygonPoints, toolState.mousePosition],
      };
    }

    return (
      <>
        <TracksGeographic colors={colors[mapStyle]} />
        <EditorZone newZone={newZone} />
      </>
    );
  },
  getInteractiveLayers() {
    return [];
  },

  getCursor(toolState, editorState, {isDragging}) {
    if (isDragging) return 'move';
    return 'crosshair';
  },
};
