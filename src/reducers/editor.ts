/* eslint-disable default-case */
import produce from 'immer';
import { GeoJSON } from 'geojson';
import { ThunkAction, Path, Point, Bbox, ChartisAction } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getChartisLayers, saveChartisActions } from '../applications/editor/api';

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
        const data = await getChartisLayers([topLeft, bottomRight], ['map_midi_circuitdevoie']);
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
  return (dispatch) => {
    dispatch({
      type: SELECTED_ZONE_LOADED,
      data: geojsons,
    });
  };
}

const CREATE_LINE = 'editor/CREATE_LINE';
type ActionCreateLine = { type: typeof CREATE_LINE; line: Path };
export function createLine(line: Path): ThunkAction<ActionCreateLine> {
  return (dispatch) => {
    dispatch({
      type: CREATE_LINE,
      line,
    });
    dispatch(
      createModificationAction({
        type: 'insert',
        layer: 'map_midi_circuitdevoie',
        geometry: {
          type: 'LineString',
          coordinates: line,
        },
      }),
    );
  };
}

const CREATE_MODIFICATION_ACTION = 'editor/CREATE_MODIFICATION_ACTION';
type ActionCreateModificationAction = {
  type: typeof CREATE_MODIFICATION_ACTION;
  action: ChartisAction;
};
export function createModificationAction(
  action: ChartisAction,
): ThunkAction<ActionCreateModificationAction> {
  return (dispatch) => {
    dispatch({
      type: CREATE_MODIFICATION_ACTION,
      action,
    });
    // TODO: need to be triggered from an other way
    dispatch(saveModificationActions());
  };
}

const CLEAR_MODIFICATION_ACTIONS = 'editor/CLEAR_MODIFICATION_ACTIONS';
type ActionClearModificationActions = {
  type: typeof CLEAR_MODIFICATION_ACTIONS;
};
export function clearModificationActions(): ThunkAction<ActionClearModificationActions> {
  return (dispatch) => {
    dispatch({
      type: CLEAR_MODIFICATION_ACTIONS,
    });
  };
}

const SAVE_MODIFICATION_ACTIONS = 'editor/SAVE_MODIFICATION_ACTIONS';
type ActionSaveModificationActions = {
  type: typeof SAVE_MODIFICATION_ACTIONS;
};
export function saveModificationActions(): ThunkAction<ActionSaveModificationActions> {
  return async (dispatch, getState) => {
    const state = getState();
    console.log(state);
    dispatch(setLoading());
    try {
      const data = await saveChartisActions(state.editor.editionActions);
      dispatch(
        setSuccess({
          title: 'Modifications enregistrées',
          text: `Vos ${state.editor.editionActions.length} modifications ont été publiées`,
        }),
      );
      dispatch(clearModificationActions());
    } catch (e) {
      dispatch(setFailure(e));
    }
  };
}

type Actions =
  | ActionSelectTool
  | ActionSelectZone
  | ActionSelectedZoneLoaded
  | ActionCreateLine
  | ActionCreateModificationAction
  | ActionSaveModificationActions
  | ActionClearModificationActions;

//
// State definition
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export interface EditorState {
  activeTool: string;
  editionZone: Bbox | null;
  editionData: Array<GeoJSON> | null;
  editionActions: Array<ChartisAction>;
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
  // List of modification actions
  editionActions: [],
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
      case CREATE_MODIFICATION_ACTION:
        draft.editionActions = state.editionActions.concat([action.action]);
        break;
      case CLEAR_MODIFICATION_ACTIONS:
        draft.editionActions = [];
        break;
    }
  });
}
