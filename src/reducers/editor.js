/* eslint-disable default-case */
import produce from 'immer';
import { setLoading, setSuccess, setFailure } from './main';
import { getGeoJson } from '../applications/editor/api';

// Action Types
const SELECT_TOOL = 'editor/SELECT_TOOL';
const SELECT_ZONE = 'editor/SELECT_ZONE';
const SELECTED_ZONE_LOADED = 'editor/SELECTED_ZONE_LOADED';
const CREATE_LINE = 'editor/CREATE_LINE';

export const initialState = {
  // Tool state:
  activeTool: 'select-zone',
  // Edition zone:
  editionZone: null, // null or [[topLeftLng, topLeftLat], [bottomRightLng, bottomRightLat]]
  // Data of the edition zone
  // An array of geojson (one per layer)
  editionData: null,
  // New items:
  lines: [], // an array of paths (arrays of [lng, lat] points)
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case SELECT_TOOL:
        draft.activeTool = action.tool;
        break;
      case SELECT_ZONE:
        if (action.corners) {
          const [c1, c2] = action.corners;
          draft.editionZone = [
            [Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1])],
            [Math.max(c1[0], c2[0]), Math.max(c1[1], c2[1])],
          ];
        } else {
          draft.editionZone = null;
        }
        break;
      case SELECTED_ZONE_LOADED:
        draft.editionData = action.data;
        break;
      case CREATE_LINE:
        draft.lines = state.lines.concat([action.line]);
        break;
    }
  });
}

export function selectTool(tool) {
  return (dispatch) => {
    dispatch({
      type: SELECT_TOOL,
      tool,
    });
  };
}

export function setEditionData(geojsons) {
  return (dispatch) => {
    dispatch({
      type: SELECTED_ZONE_LOADED,
      data: geojsons,
    });
  };
}

export function selectZone(topLeft, bottomRight) {
  return async (dispatch) => {
    dispatch({
      type: SELECT_ZONE,
      corners: [topLeft, bottomRight],
    });
    // load the data
    if (topLeft && bottomRight) {
      dispatch(setLoading());
      try {
        const data = await getGeoJson([topLeft, bottomRight], ['map_midi_circuitdevoie']);
        dispatch(setSuccess());
        dispatch(setEditionData(data));
      } catch (e) {
        dispatch(setFailure(e));
      }
    }
  };
}

export function createLine(line) {
  return (dispatch) => {
    dispatch({
      type: CREATE_LINE,
      line,
    });
  };
}
