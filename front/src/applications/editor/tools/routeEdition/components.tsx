import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../context';
import { ExtendedEditorContextType } from '../types';
import colors from '../../../../common/Map/Consts/colors';
import GeoJSONs from '../../../../common/Map/Layers/GeoJSONs';
import { RouteEditionState } from './types';
import { EditRoutePathEditionLayers, EditRoutePathLeftPanel } from './components/EditRoutePath';
import { EditRouteMetadataLayers, EditRouteMetadataPanel } from './components/EditRouteMetadata';

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
  const { mapStyle } = useSelector((s: { map: { mapStyle: string } }) => s.map) as {
    mapStyle: string;
  };

  return (
    <>
      {/* Editor data layer */}
      {/*
       (a fake selection must be given to grey everything, else the component
       will consider nothing is selected and nothing must be greyed)
       */}
      <GeoJSONs
        selection={['placeholder']}
        colors={colors[mapStyle]}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
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
