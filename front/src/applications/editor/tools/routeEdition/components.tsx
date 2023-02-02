import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../context';
import { ExtendedEditorContextType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { RouteEditionState } from './types';
import { CreateRouteEditionLayers, CreateRouteLeftPanel } from './components/CreateRoute';
import { EditRouteEditionLayers, EditRouteLeftPanel } from './components/EditRoute';

export const RouteEditionLeftPanel: FC = () => {
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  return (
    <div>
      {state.type === 'createRoute' ? (
        <CreateRouteLeftPanel key="createRoute" state={state} />
      ) : (
        <EditRouteLeftPanel key="createRoute" state={state} />
      )}
    </div>
  );
};

export const RouteEditionLayers: FC = () => {
  const {
    state,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs selection={["grise z'y donc"]} colors={colors[mapStyle]} layers={editorLayers} />
      {state.type === 'createRoute' ? (
        <CreateRouteEditionLayers key="createRoute" state={state} />
      ) : (
        <EditRouteEditionLayers key="createRoute" state={state} />
      )}
    </>
  );
};

export const RouteMessages: FC = () => {
  const { t } = useTranslation();
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  if (state.type === 'createRoute') {
    if (state.extremityEditionState.type === 'selection')
      return t('Editor.tools.routes-edition.help.select-waypoint');
    if (!state.routeState.entryPoint || !state.routeState.exitPoint)
      return t('Editor.tools.routes-edition.help.select-endpoints');
    if (state.optionsState.type === 'options')
      return t('Editor.tools.routes-edition.help.select-route');
  } else {
    return t('Editor.tools.routes-edition.help.actions-on-edit-route');
  }

  return null;
};
