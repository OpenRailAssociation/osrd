import { useContext } from 'react';

import { useTranslation } from 'react-i18next';

import EditorContext from 'applications/editor/context';
import { NEW_ENTITY_ID } from 'applications/editor/data/utils';
import type { RouteEditionState } from 'applications/editor/tools/routeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

const RouteEditionMessages = () => {
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

export default RouteEditionMessages;
