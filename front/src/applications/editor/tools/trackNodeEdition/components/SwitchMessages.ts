import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../../context';
import type { ExtendedEditorContextType } from '../../editorContextTypes';
import { TrackNodeEditionState } from '../types';

const TrackNodeMessages = () => {
  const { t } = useTranslation();
  const {
    state: { portEditionState },
  } = useContext(EditorContext) as ExtendedEditorContextType<TrackNodeEditionState>;
  return portEditionState.type === 'selection'
    ? t('Editor.tools.track-node-edition.help.select-track')
    : t('Editor.tools.track-node-edition.help.no-move');
};

export default TrackNodeMessages;
