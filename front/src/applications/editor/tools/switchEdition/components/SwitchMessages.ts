import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import EditorContext from '../../../context';
import type { ExtendedEditorContextType } from '../../editorContextTypes';
import { SwitchEditionState } from '../types';

const SwitchMessages = () => {
  const { t } = useTranslation();
  const {
    state: { portEditionState },
  } = useContext(EditorContext) as ExtendedEditorContextType<SwitchEditionState>;
  return portEditionState.type === 'selection'
    ? t('Editor.tools.switch-edition.help.select-track')
    : t('Editor.tools.switch-edition.help.no-move');
};

export default SwitchMessages;
