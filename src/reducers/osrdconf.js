/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const UPDATE_NAME = 'osrdconf/UPDATE_NAME';
export const UPDATE_INFRA_ID = 'osrdconf/UPDATE_INFRA_ID';
export const UPDATE_PATHFINDING_ID = 'osrdconf/UPDATE_PATHFINDING_ID';
export const UPDATE_TIMETABLE_ID = 'osrdconf/UPDATE_TIMETABLE_ID';
export const UPDATE_ORIGIN = 'osrdconf/UPDATE_ORIGIN';
export const UPDATE_ORIGIN_TIME = 'osrdconf/UPDATE_ORIGIN_TIME';
export const REPLACE_VIAS = 'osrdconf/REPLACE_VIAS';
export const UPDATE_VIAS = 'osrdconf/UPDATE_VIAS';
export const UPDATE_VIA_STOPTIME = 'osrdconf/UPDATE_VIA_STOPTIME';
export const PERMUTE_VIAS = 'osrdconf/PERMUTE_VIAS';
export const DELETE_VIAS = 'osrdconf/DELETE_VIAS';
export const UPDATE_DESTINATION = 'osrdconf/UPDATE_DESTINATION';
export const UPDATE_TRAINCOMPO = 'osrdconf/UPDATE_TRAINCOMPO';
export const UPDATE_ITINERARY = 'osrdconf/UPDATE_ITINERARY';
export const UPDATE_FEATURE_INFO_CLICK_OSRD = 'osrdconf/UPDATE_FEATURE_INFO_CLICK_OSRD';
export const ERASE_SIMULATION = 'osrdconf/ERASE_SIMULATION';

// Reducer
export const initialState = {
  name: '',
  infraID: undefined,
  pathfindingID: undefined,
  timetableID: undefined,
  origin: undefined,
  originTime: undefined,
  destination: undefined,
  vias: [],
  trainCompo: undefined,
  geojson: undefined,
  featureInfoClick: { displayPopup: false },
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_NAME:
        draft.name = action.name;
        break;
      case UPDATE_INFRA_ID:
        draft.infraID = action.infraID;
        break;
      case UPDATE_PATHFINDING_ID:
        draft.pathfindingID = action.pathfindingID;
        break;
      case UPDATE_TIMETABLE_ID:
        draft.timetableID = action.timetableID;
        break;
      case UPDATE_ORIGIN:
        draft.origin = action.origin;
        break;
      case UPDATE_ORIGIN_TIME:
        draft.originTime = action.originTime;
        break;
      case REPLACE_VIAS:
        draft.vias = action.vias;
        break;
      case UPDATE_VIAS:
        draft.vias.push(action.vias);
        break;
      case UPDATE_VIA_STOPTIME:
        draft.vias = action.vias;
        break;
      case PERMUTE_VIAS:
        draft.vias = action.vias;
        break;
      case DELETE_VIAS:
        draft.vias.splice(action.index, 1);
        break;
      case UPDATE_DESTINATION:
        draft.destination = action.destination;
        break;
      case UPDATE_TRAINCOMPO:
        draft.trainCompo = action.trainCompo;
        break;
      case UPDATE_ITINERARY:
        draft.geojson = action.geojson;
        break;
      case UPDATE_FEATURE_INFO_CLICK_OSRD:
        draft.featureInfoClick = action.featureInfoClick;
        break;
      case ERASE_SIMULATION:
        draft.name = '';
        draft.origin = undefined;
        draft.originTime = undefined;
        draft.destination = undefined;
        draft.destinationTime = undefined;
        draft.vias = [];
        draft.trainCompo = undefined;
        draft.geojson = undefined;
        break;
    }
  });
}

// Functions
export function updateName(name) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_NAME,
      name,
    });
  };
}
export function updateInfraID(infraID) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_INFRA_ID,
      infraID,
    });
  };
}
export function updatePathfindingID(pathfindingID) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_PATHFINDING_ID,
      pathfindingID,
    });
  };
}
export function updateTimetableID(timetableID) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_TIMETABLE_ID,
      timetableID,
    });
  };
}
export function updateOrigin(origin) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ORIGIN,
      origin,
    });
  };
}
export function updateOriginTime(originTime) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ORIGIN_TIME,
      originTime,
    });
  };
}
export function replaceVias(vias) {
  return (dispatch) => {
    dispatch({
      type: REPLACE_VIAS,
      vias,
    });
  };
}
export function updateVias(vias) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_VIAS,
      vias,
    });
  };
}
export function permuteVias(vias, from, to) {
  const newVias = Array.from(vias); // Copy of vias to permit modification
  const item = newVias.slice(from, from + 1); // Get item to permute
  newVias.splice(from, 1); // Remove it from array
  newVias.splice(to, 0, item[0]); // Replace to right position

  return (dispatch) => {
    dispatch({
      type: PERMUTE_VIAS,
      vias: newVias,
    });
  };
}
export function updateViaStopTime(vias, index, value) {
  const newVias = Array.from(vias); // Copy of vias to permit modification
  newVias[index] = { ...newVias[index], stoptime: value };
  return (dispatch) => {
    dispatch({
      type: UPDATE_VIA_STOPTIME,
      vias: newVias,
    });
  };
}
export function deleteVias(index) {
  return (dispatch) => {
    dispatch({
      type: DELETE_VIAS,
      index,
    });
  };
}
export function updateDestination(destination) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_DESTINATION,
      destination,
    });
  };
}
export function updateTrainCompo(trainCompo) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_TRAINCOMPO,
      trainCompo,
    });
  };
}
export function updateItinerary(geojson) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_ITINERARY,
      geojson,
    });
  };
}
export function updateFeatureInfoClickOSRD(featureInfoClick) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_FEATURE_INFO_CLICK_OSRD,
      featureInfoClick,
    });
  };
}
export function eraseSimulation() {
  return (dispatch) => {
    dispatch({
      type: ERASE_SIMULATION,
    });
  };
}
