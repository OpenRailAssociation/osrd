/* eslint-disable default-case */
import produce from 'immer';

// Action Types
const SELECT_TOOL = 'editor/SELECT_TOOL';
const SELECT_ZONE = 'editor/SELECT_ZONE';

export const initialState = {
  // Tool state:
  activeTool: 'select-zone',

  // Edition zone:
  editionZone: null, // null or [[topLeftLng, topLeftLat], [bottomRightLng, bottomRightLat]]
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

export function selectZone(topLeft, bottomRight) {
  return (dispatch) => {
    dispatch({
      type: SELECT_ZONE,
      corners: [topLeft, bottomRight],
    });
  };
}
