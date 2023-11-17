import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { compact } from 'lodash';
import EditorContext from 'applications/editor/context';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import { getMap } from 'reducers/map/selectors';
import { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import { EditRoutePathState, RouteEditionState } from './types';
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
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);

  const { routeState, optionsState } = state as EditRoutePathState;
  const selectedRouteIndex =
    optionsState.type === 'options' ? optionsState.focusedOptionIndex : undefined;
  const selectedRouteDetectors =
    selectedRouteIndex !== undefined
      ? optionsState.options![selectedRouteIndex].data.detectors
      : [];
  const selectedRouteSwitches =
    selectedRouteIndex !== undefined
      ? Object.keys(optionsState.options![selectedRouteIndex].data.switches_directions)
      : [];
  const selectionList = compact([routeState.entryPoint?.id, routeState.exitPoint?.id]).concat(
    selectedRouteDetectors,
    selectedRouteSwitches
  );

  return (
    <>
      {/* Editor data layer */}
      <GeoJSONs
        selection={selectionList.length > 1 ? selectionList : undefined}
        colors={colors[mapStyle]}
        layers={editorLayers}
        fingerprint={renderingFingerprint}
        layersSettings={layersSettings}
        issuesSettings={issuesSettings}
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
