import React, { FC, useContext } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { compact } from 'lodash';

import EditorContext from 'applications/editor/context';
import type { ExtendedEditorContextType } from 'applications/editor/tools/editorContextTypes';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import colors from 'common/Map/Consts/colors';
import GeoJSONs from 'common/Map/Layers/GeoJSONs';
import { getMap } from 'reducers/map/selectors';
import { useInfraID } from 'common/osrdContext';
import type { RouteEditionState } from './types';
import { RouteEditionPanel } from './components/RouteEditionPanel';
import { RouteEditionLayers } from './components/RouteEditionLayer';

export const LeftPanel: FC = () => {
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;
  return <RouteEditionPanel state={state} />;
};

export const Layers: FC = () => {
  const {
    state,
    renderingFingerprint,
    editorState: { editorLayers },
  } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;
  const { mapStyle, layersSettings, issuesSettings } = useSelector(getMap);
  const infraID = useInfraID();
  const { optionsState } = state as RouteEditionState;

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

  const selectionList = compact([
    state.entity?.properties.entry_point.id,
    state.entity?.properties.exit_point?.id,
  ]).concat(selectedRouteDetectors, selectedRouteSwitches);

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
        infraID={infraID}
      />
      <RouteEditionLayers state={state} />
    </>
  );
};

export const Messages: FC = () => {
  const { t } = useTranslation();
  const { state } = useContext(EditorContext) as ExtendedEditorContextType<RouteEditionState>;

  if (state.extremityState.type === 'selection')
    return t('Editor.tools.routes-edition.help.select-waypoint');
  if (
    state.entity.properties.entry_point.id === NEW_ENTITY_ID ||
    state.entity.properties.exit_point.id === NEW_ENTITY_ID
  )
    return t('Editor.tools.routes-edition.help.select-endpoints');
  if (state.optionsState.type === 'options')
    return t('Editor.tools.routes-edition.help.select-route');

  return null;
};
