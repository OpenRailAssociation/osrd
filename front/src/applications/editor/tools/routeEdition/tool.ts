import { GiPathDistance } from 'react-icons/gi';
import { TiDeleteOutline } from 'react-icons/ti';
import { IoMdAddCircleOutline } from 'react-icons/io';

import { Tool } from '../types';
import { RouteEditionState } from './types';
import { WayPointEntity } from '../../../../types';
import { RouteEditionLayers, RouteEditionLeftPanel, RouteMessages } from './components';
import { getEmptyCreateRouteState } from './utils';

const RouteEditionTool: Tool<RouteEditionState> = {
  id: 'route-edition',
  icon: GiPathDistance,
  labelTranslationKey: 'Editor.tools.routes-edition.label',
  requiredLayers: new Set(['buffer_stops', 'detectors', 'track_sections']),

  getInitialState() {
    return getEmptyCreateRouteState();
  },

  actions: [],

  getCursor({ state }) {
    if (
      state.type === 'createRoute' &&
      state.extremityEditionState.type === 'selection' &&
      state.hovered
    )
      return 'pointer';
    return 'default';
  },
  onKeyDown(e, { state, setState }) {
    if (
      state.type === 'createRoute' &&
      state.extremityEditionState.type === 'selection' &&
      e.key === 'Escape'
    ) {
      setState({
        ...state,
        extremityEditionState: { type: 'idle' },
      });
    }
  },
  onClickEntity(feature, _e, { state }) {
    if (
      state.type === 'createRoute' &&
      state.extremityEditionState.type === 'selection' &&
      (feature.objType === 'Detector' || feature.objType === 'BufferStop')
    ) {
      state.extremityEditionState.onSelect(feature as WayPointEntity);
    }
  },

  messagesComponent: RouteMessages,
  layersComponent: RouteEditionLayers,
  leftPanelComponent: RouteEditionLeftPanel,
  getInteractiveLayers() {
    return ['editor/geo/buffer-stop-main', 'editor/geo/detector-main', 'editor/geo/detector-name'];
  },
};

export default RouteEditionTool;
