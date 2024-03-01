import { useContext } from 'react';

import { useTranslation } from 'react-i18next';

import EditorContext from 'applications/editor/context';
import type { SwitchEditionState } from 'applications/editor/tools/switchEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

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
