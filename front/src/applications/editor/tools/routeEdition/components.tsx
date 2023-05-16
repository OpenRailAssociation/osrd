import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../context';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { RouteEditionState } from './types';
import { EditRoutePathEditionLayers, EditRoutePathLeftPanel } from './components/EditRoutePath';
import { EditRouteMetadataLayers, EditRouteMetadataPanel } from './components/EditRouteMetadata';
import { getMap } from '../../../../reducers/map/selectors';
import { ExtendedEditorContextType } from '../editorContextTypes';

export const RouteEditionLeftPanel: FC = () => {
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  return (
    <div>
      {state.type === 'editRoutePath' ? (
        <EditRoutePathLeftPanel key="editRoutePath" state={state} />
      ) : (
        <EditRouteMetadataPanel key="editRouteMetadata" state={state} />
      )}
    </div>
  );
};

export const RouteEditionLayers: FC = () => {
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;
  const { mapStyle, layersSettings } = useSelector(getMap);

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        selection={['placeholder']}
        colors={colors[mapStyle]}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
      />
      {state.type === 'editRoutePath' ? (
        <EditRoutePathEditionLayers key="editRoutePath" state={state} />
      ) : (
        <EditRouteMetadataLayers key="editRouteMetadata" state={state} />
      )}
    </>
  );
};

export const RouteMessages: FC = () => {
  const { t } = useTranslation();
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  if (state.type === 'editRoutePath') {
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
