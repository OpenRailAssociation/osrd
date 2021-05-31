/* eslint-disable default-case */
import produce from 'immer';
import { flatten } from 'lodash';
import { BBox } from '@turf/helpers';
import { createSelector } from 'reselect';
import { Feature, FeatureCollection, GeoJSON } from 'geojson';

import { ThunkAction, Path, ChartisAction, LineProperties, Zone } from '../types';
import { setLoading, setSuccess, setFailure } from './main';
import { getChartisLayers, saveChartisActions } from '../applications/editor/api';
import { clip, extractPoints } from '../utils/mapboxHelper';

//
// Actions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const SELECT_ZONE = 'editor/SELECT_ZONE';
type ActionSelectZone = { type: typeof SELECT_ZONE; zone: Zone | null };
export function selectZone(zone: Zone | null): ThunkAction<ActionSelectZone> {
  return async (dispatch: any) => {
    dispatch({
      type: SELECT_ZONE,
      zone,
    });

    // load the data
    if (zone) {
      dispatch(setLoading());
      try {
        const data = await getChartisLayers(zone, ['map_midi_circuitdevoie']);
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
type ActionCreateLine = { type: typeof CREATE_LINE; feature: Feature };
export function createLine(line: Path, properties: LineProperties): ThunkAction<ActionCreateLine> {
  return (dispatch) => {
    dispatch({
      type: CREATE_LINE,
      feature: {
        type: 'Feature',
        properties,
        geometry: {
          type: 'LineString',
          coordinates: line,
        },
      },
    });
    dispatch(
      createModificationAction({
        layer: 'map_midi_circuitdevoie',
        type: 'insert',
        properties,
        geometry: {
          type: 'LineString',
          coordinates: line,
        },
      })
    );
  };
}

const CREATE_MODIFICATION_ACTION = 'editor/CREATE_MODIFICATION_ACTION';
type ActionCreateModificationAction = {
  type: typeof CREATE_MODIFICATION_ACTION;
  action: ChartisAction;
};
export function createModificationAction(
  action: ChartisAction
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
        })
      );
      dispatch(clearModificationActions());
    } catch (e) {
      dispatch(setFailure(e));
    }
  };
}

type Actions =
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
  editionZone: Zone | null;
  editionData: Array<GeoJSON> | null;
  editionActions: Array<ChartisAction>;
}

export const initialState: EditorState = {
  // Edition zone:
  editionZone: null,
  // Data of the edition zone
  // An array of GeoJSONs (one per layer)
  editionData: null,
  // List of modification actions
  editionActions: [],
};

//
// State reducer
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export default function reducer(state = initialState, action: Actions) {
  return produce(state, (draft) => {
    switch (action.type) {
      case SELECT_ZONE:
        draft.editionZone = action.zone;
        break;
      case SELECTED_ZONE_LOADED:
        draft.editionData = action.data;
        break;
      case CREATE_LINE: {
        const layers = state.editionData || [];
        const layer = layers[0] as FeatureCollection | null;
        draft.editionData = layer
          ? [
              {
                ...layer,
                features: layer.features.concat([action.feature]),
                // @ts-ignore
                count: layer.count + 1,
              },
              ...layers.slice(1),
            ]
          : [{ type: 'FeatureCollection', count: 1, features: action.feature }];
        break;
      }
      case CREATE_MODIFICATION_ACTION:
        draft.editionActions = state.editionActions.concat([action.action]);
        break;
      case CLEAR_MODIFICATION_ACTIONS:
        draft.editionActions = [];
        break;
    }
  });
}

//
// Derived data selector
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const dataSelector = (state: EditorState) => state.editionData;
export const zoneSelector = (state: EditorState) => state.editionZone;
export const pointsSelector = createSelector(dataSelector, (data) =>
  (data || []).map((geoJSON) => ({
    ...(geoJSON as FeatureCollection),
    features: extractPoints(geoJSON as FeatureCollection),
  }))
);

export const clippedDataSelector = createSelector(dataSelector, zoneSelector, (data, zone) => {
  return zone && data
    ? data.map((geoJSON) => clip(geoJSON as FeatureCollection, zone) as FeatureCollection)
    : [];
});
export const clippedPointsSelector = createSelector(
  pointsSelector,
  zoneSelector,
  (pointsCollections, zone) => {
    return zone && pointsCollections
      ? pointsCollections.map(
          (pointsCollection) => clip(pointsCollection, zone) as FeatureCollection
        )
      : [];
  }
);
