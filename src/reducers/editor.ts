/* eslint-disable default-case */
import produce from 'immer';
import { GeoJSON } from 'geojson';
import { ThunkAction, Path, Point, Bbox } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getGeoJson } from '../applications/editor/api';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const SELECT_TOOL = 'editor/SELECT_TOOL';
type ActionSelectTool = { type: typeof SELECT_TOOL; tool: string };
export function selectTool(tool: string): ThunkAction<ActionSelectTool> {
  return (dispatch: any) => {
    dispatch({
      type: SELECT_TOOL,
      tool,
    });
  };
}

const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = { type: typeof SELECT_ZONE; corners: [Point, Point] };
export function selectZone(topLeft: Point, bottomRight: Point): ThunkAction<ActionSelectZone> {
  return async (dispatch: any) => {
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

const SELECTED_ZONE_LOADED = 'editor/SELECTED_ZONE_LOADED';
type ActionSelectedZoneLoaded = {
  type: typeof SELECTED_ZONE_LOADED;
  data: Array<GeoJSON> | null;
};
export function setEditionData(geojsons: Array<GeoJSON>): ThunkAction<ActionSelectedZoneLoaded> {
  return (dispatch: any) => {
    dispatch({
      type: SELECTED_ZONE_LOADED,
      data: geojsons,
    });
  };
}

const CREATE_LINE = 'editor/CREATE_LINE';
type ActionCreateLine = { type: typeof CREATE_LINE; line: Path };
export function createLine(line: Path): ThunkAction<ActionCreateLine> {
  return (dispatch: any) => {
    dispatch({
      type: CREATE_LINE,
      line,
    });
  };
}

type Actions = ActionSelectTool | ActionSelectZone | ActionSelectedZoneLoaded | ActionCreateLine;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface EditorState {
  activeTool: string;
  editionZone: Bbox | null;
  editionData: Array<GeoJSON> | null;
  lines: Array<Path>;
}

export const initialState: EditorState = {
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

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(state = initialState, action: Actions) {
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
