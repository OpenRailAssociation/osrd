import { useContext } from 'react';

import { useTranslation } from 'react-i18next';

import EditorContext from 'applications/editor/context';
import type { ExtendedEditorContextType } from 'applications/editor/types';

import type { OpEditionState } from '../types';

const OpEditionMessages = () => {
  const { t } = useTranslation();
  const {
    state: { interactionState },
  } = useContext(EditorContext) as ExtendedEditorContextType<OpEditionState>;

  return interactionState.type === 'movePart'
    ? t('Editor.tools.op-edition.help.drag-part')
    : t('Editor.tools.op-edition.help.init');
};

export default OpEditionMessages;
