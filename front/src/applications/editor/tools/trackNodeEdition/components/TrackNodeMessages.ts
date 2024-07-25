import { useContext } from 'react';

import { useTranslation } from 'react-i18next';

import EditorContext from 'applications/editor/context';
import type { TrackNodeEditionState } from 'applications/editor/tools/trackNodeEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

const TrackNodeMessages = () => {
  const { t } = useTranslation();
  const {
    state: { portEditionState },
  } = useContext(EditorContext) as ExtendedEditorContextType<TrackNodeEditionState>;
  return portEditionState.type === 'selection'
    ? t('Editor.tools.switch-edition.help.select-track')
    : t('Editor.tools.switch-edition.help.no-move');
};

export default TrackNodeMessages;
