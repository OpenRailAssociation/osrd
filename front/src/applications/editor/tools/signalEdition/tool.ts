import { cloneDeep } from 'lodash';
import { Feature, LineString } from 'geojson';
import { FaMapSigns, BiTrash } from 'react-icons/all';

import { DEFAULT_COMMON_TOOL_STATE, Tool } from '../types';
import { getNearestPoint } from '../../../../utils/mapboxHelper';
import { SIGNAL_LAYER_ID, SignalEditionLayers, SignalEditionLeftPanel } from './components';
import { SignalEditionState } from './types';
import { getNewSignal } from './utils';

const SignalEditionTool: Tool<SignalEditionState> = {
  id: 'signal-edition',
  icon: FaMapSigns,
  labelTranslationKey: 'Editor.tools.signal-edition.label',
  isDisabled({ editorState }) {
    return !editorState.editorZone;
  },
  getRadius() {
    return 50;
  },
  getInitialState() {
    const signal = getNewSignal([1, 1]);
    return {
      ...DEFAULT_COMMON_TOOL_STATE,
      signal,
      initialSignal: signal,
      isDragging: false,
      nearestPoint: null,
    };
  },
  actions: [
    [
      {
        id: 'new-signal',
        icon: BiTrash,
        labelTranslationKey: 'Editor.tools.signal-edition.actions.new-signal',
        onClick({ setState, state, mapState }) {
          setState({
            ...state,
            signal: getNewSignal([
              mapState.viewport.latitude || 0,
              mapState.viewport.longitude || 0,
            ]),
          });
        },
      },
    ],
  ],

  // Interactions:
  onClickMap(_e, { setState, state }) {
    const { isDragging, isHoveringTarget, signal, nearestPoint } = state;

    if (!isDragging && isHoveringTarget) {
      setState({
        ...state,
        isDragging: true,
        isHoveringTarget: false,
      });
    }

    if (isDragging && nearestPoint) {
      const newSignal = cloneDeep(signal);
      newSignal.geometry.coordinates = nearestPoint.feature.geometry.coordinates;
      newSignal.properties = newSignal.properties || {};
      newSignal.properties.track = { id: nearestPoint.trackSectionID, type: 'TrackSection' };

      setState({
        ...state,
        signal: newSignal,
        isDragging: false,
        nearestPoint: null,
      });
    }
  },
  onHover(e, { setState, state, editorState: { editorDataIndex } }) {
    const { isDragging } = state;

    const hoveredTarget = (e.features || []).find((f) => f.layer.id === SIGNAL_LAYER_ID);
    const hoveredTracks = (e.features || []).flatMap((f) => {
      if (f.layer.id !== 'editor/geo/track-main') return [];
      const entity = editorDataIndex[f.properties.id];
      return entity && entity.objType === 'TrackSection' ? [entity] : [];
    }) as Feature<LineString>[];

    if (isDragging) {
      if (hoveredTracks.length) {
        const nearestPoint = getNearestPoint(hoveredTracks, e.lngLat);
        setState({
          ...state,
          nearestPoint: {
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
  onMove(e, { state, setState }) {
    const { isDragging, signal, nearestPoint } = state;
    if (isDragging) {
      const newSignal = cloneDeep(signal);
      if (nearestPoint) {
        newSignal.geometry.coordinates = nearestPoint.feature.geometry.coordinates;
        newSignal.properties = newSignal.properties || {};
        newSignal.properties.track = { id: nearestPoint.trackSectionID, type: 'TrackSection' };
      } else {
        newSignal.geometry.coordinates = e.lngLat;
        newSignal.properties = newSignal.properties || {};
        newSignal.properties.track = null;
      }

      setState({
        ...state,
        signal: newSignal,
      });
    }
  },
  onKeyDown(e, { state, setState }) {
    if (e.key === 'Escape') {
      if (state.isDragging) {
        setState({ ...state, nearestPoint: null, isDragging: false, signal: state.initialSignal });
      }
    }
  },

  getInteractiveLayers() {
    return ['editor/geo/track-main', SIGNAL_LAYER_ID];
  },
  getCursor({ state }, { isDragging }) {
    if (isDragging || state.isDragging) return 'move';
    return 'default';
  },

  layersComponent: SignalEditionLayers,
  leftPanelComponent: SignalEditionLeftPanel,
};

export default SignalEditionTool;
