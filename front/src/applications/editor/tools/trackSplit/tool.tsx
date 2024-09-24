import { AiFillSave } from 'react-icons/ai';
import { FaScissors } from 'react-icons/fa6';
import { MdShowChart } from 'react-icons/md';

import { POINTS_LAYER_ID, TRACK_LAYER_ID } from 'applications/editor/tools/trackEdition/consts';
import type { Tool } from 'applications/editor/types';
import { nearestPointOnLine } from 'utils/geometry';
import { getMapMouseEventNearestFeature } from 'utils/mapHelper';

import { TrackSplitLayers, TrackSplitLeftPanel, TrackSplitMessages } from './components';
import type { TrackSplitState } from './types';
import { isOffsetValid } from './utils';
import TOOL_NAMES from '../constsToolNames';
import { approximateDistanceForEditoast, getNewLine } from '../utils';

const TrackSplitTool: Tool<TrackSplitState> = {
  id: 'track-split',
  icon: MdShowChart,
  labelTranslationKey: 'Editor.tools.track-edition.label',
  requiredLayers: new Set(['track_sections']),
  getInitialState: () => ({
    track: getNewLine([]),
    offset: 0,
    splitState: { type: 'idle' },
  }),
  onClick: ({ switchTool }) => {
    switchTool({ toolType: TOOL_NAMES.TRACK_EDITION, toolState: {} });
  },
  isHidden({ activeTool }) {
    return activeTool.id !== TOOL_NAMES.TRACK_SPLIT;
  },
  actions: [
    [
      {
        id: 'track-split',
        icon: FaScissors,
        isActive: () => true,
        labelTranslationKey: 'Editor.tools.track-split.label',
      },
      {
        id: 'save-split',
        icon: AiFillSave,
        labelTranslationKey: 'Editor.tools.track-split.actions.save',
        isDisabled({ state, isLoading, isInfraLocked }) {
          return isLoading || isInfraLocked || false || !isOffsetValid(state.offset, state.track);
        },
        async onClick({ setIsFormSubmitted }) {
          if (setIsFormSubmitted) {
            setIsFormSubmitted(true);
          }
        },
      },
    ],
  ],

  // Interactions:
  onMove(e, { state, setState }) {
    // default next state
    let nextState: TrackSplitState = { ...state, splitState: { type: 'idle' } };

    // if user is moving the split point
    if (state.splitState.type === 'movePoint') {
      const splitPoint = nearestPointOnLine(state.track.geometry, [e.lngLat.lng, e.lngLat.lat], {
        units: 'millimeters',
      });
      nextState = {
        ...state,
        splitState: {
          type: 'movePoint',
          offset: Math.round(
            approximateDistanceForEditoast(state.track, splitPoint.properties.location / 1000) *
              1000
          ),
        },
      };
    }
    // otherwise, we check if we hover the split point or the track
    else {
      const nearestResult = getMapMouseEventNearestFeature(e, {
        layersId: [POINTS_LAYER_ID, TRACK_LAYER_ID],
      });
      if (nearestResult) {
        const { feature } = nearestResult;
        // User hovers the split point, we set in the state so we can change the cursor
        if (feature.layer.id === POINTS_LAYER_ID) {
          nextState = { ...state, splitState: { type: 'hoverPoint' } };
        }
        // User hovers the track, we set in the state so we can change the cursor
        else if (feature.layer.id === TRACK_LAYER_ID) {
          const splitPoint = nearestPointOnLine(
            state.track.geometry,
            [e.lngLat.lng, e.lngLat.lat],
            { units: 'millimeters' }
          );
          nextState = {
            ...state,
            splitState: {
              type: 'splitLine',
              offset: Math.round(
                approximateDistanceForEditoast(state.track, splitPoint.properties.location / 1000) *
                  1000
              ),
            },
          };
        }
      }
    }
    setState(nextState);
  },
  onClickMap(e, { state, setState }) {
    if (state.splitState.type === 'splitLine') {
      setState({
        ...state,
        offset: state.splitState.offset,
        splitState: { type: 'idle' },
      });
    }
    if (state.splitState.type === 'hoverPoint') {
      const splitPoint = nearestPointOnLine(state.track.geometry, [e.lngLat.lng, e.lngLat.lat], {
        units: 'millimeters',
      });
      setState({
        ...state,
        splitState: {
          type: 'movePoint',
          offset: Math.round(
            approximateDistanceForEditoast(state.track, splitPoint.properties.location / 1000) *
              1000
          ),
        },
      });
    }
    if (state.splitState.type === 'movePoint') {
      setState({
        ...state,
        offset: state.splitState.offset,
        splitState: { type: 'idle' },
      });
    }
  },
  onKeyDown(e, { state, setState }) {
    if (e.key === 'Escape') {
      if (state.splitState.type === 'movePoint') {
        setState({ ...state, splitState: { type: 'idle' } });
      }
    }
  },
  getCursor({ state }, { isDragging }) {
    if (isDragging) return 'grabbing';
    if (state.splitState.type === 'movePoint') return 'grabbing';
    if (state.splitState.type === 'hoverPoint') return 'pointer';
    if (state.splitState.type === 'splitLine') return 'crosshair';
    return 'default';
  },
  layersComponent: TrackSplitLayers,
  leftPanelComponent: TrackSplitLeftPanel,
  messagesComponent: TrackSplitMessages,
};

export default TrackSplitTool;
