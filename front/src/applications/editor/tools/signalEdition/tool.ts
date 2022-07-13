import { cloneDeep, isEqual, omit } from 'lodash';
import { Feature, LineString } from 'geojson';
import { FaMapSigns, BiReset, AiOutlinePlus } from 'react-icons/all';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { SIGNAL_LAYER_ID, SignalEditionLayers, SignalEditionLeftPanel } from './components';
import { SignalEditionState } from './types';
import { getNewSignal } from './utils';

function getInitialState(): SignalEditionState {
  const signal = getNewSignal();
  return {
    ...DEFAULT_COMMON_TOOL_STATE,
    signal,
    initialSignal: signal,
    nearestPoint: null,
  };
}

const SignalEditionTool: Tool<SignalEditionState> = {
  id: 'signal-edition',
  icon: FaMapSigns,
  labelTranslationKey: 'Editor.tools.signal-edition.label',
  isDisabled({ editorState }) {
    return !editorState.editorZone;
  },
  getRadius() {
    return 20;
  },
  getInitialState,
  actions: [
    [
      {
        id: 'reset-signal',
        icon: BiReset,
        labelTranslationKey: 'Editor.tools.signal-edition.actions.reset-signal',
        onClick({ setState, state }) {
          setState({
            ...getInitialState(),
            signal: state.initialSignal,
          });
        },
        isDisabled({ state }) {
          return isEqual(state.signal, state.initialSignal);
        },
      },
      {
        id: 'new-signal',
        icon: AiOutlinePlus,
        labelTranslationKey: 'Editor.tools.signal-edition.actions.new-signal',
        onClick({ setState }) {
          setState(getInitialState());
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(_e, { setState, state }) {
    const { isHoveringTarget, signal, nearestPoint } = state;

    if (signal.geometry && isHoveringTarget) {
      setState({
        ...state,
        isHoveringTarget: false,
        signal: omit(signal, 'geometry'),
      });
    }

    if (!signal.geometry && nearestPoint) {
      const newSignal = cloneDeep(signal);
      newSignal.geometry = {
        type: 'Point',
        coordinates: nearestPoint.feature.geometry.coordinates,
      };
      newSignal.properties = newSignal.properties || {};
      newSignal.properties.track = { id: nearestPoint.trackSectionID, type: 'TrackSection' };
      newSignal.properties.angle_geo = nearestPoint.angle;

      setState({
        ...state,
        signal: newSignal,
        nearestPoint: null,
      });
    }
  },
  onHover(e, { setState, state, editorState: { editorDataIndex } }) {
    const { signal } = state;

    const hoveredTarget = (e.features || []).find((f) => f.layer.id === SIGNAL_LAYER_ID);
    const hoveredTracks = (e.features || []).flatMap((f) => {
      if (f.layer.id !== 'editor/geo/track-main') return [];
      const entity = editorDataIndex[f.properties.id];
      return entity && entity.objType === 'TrackSection' ? [entity] : [];
    }) as Feature<LineString>[];

    if (!signal.geometry) {
      if (hoveredTracks.length) {
        const nearestPoint = getNearestPoint(hoveredTracks, e.lngLat);
        const angle = nearestPoint.properties.angleAtPoint;
        setState({
          ...state,
          nearestPoint: {
            angle,
            feature: nearestPoint,
            trackSectionID: hoveredTracks[nearestPoint.properties.featureIndex].id as string,
          },
        });
      } else {
        setState({
          ...state,
          nearestPoint: null,
        });
      }
    } else if (hoveredTarget) {
      setState({
        ...state,
        isHoveringTarget: true,
      });
    } else {
      setState({
        ...state,
        isHoveringTarget: false,
      });
    }
  },

  getInteractiveLayers() {
    return ['editor/geo/track-main', SIGNAL_LAYER_ID];
  },
  getCursor({ state }, { isDragging }) {
    if (isDragging || !state.signal.geometry) return 'move';
    if (state.isHoveringTarget) return 'pointer';
    return 'default';
  },

  layersComponent: SignalEditionLayers,
  leftPanelComponent: SignalEditionLeftPanel,
};

export default SignalEditionTool;
