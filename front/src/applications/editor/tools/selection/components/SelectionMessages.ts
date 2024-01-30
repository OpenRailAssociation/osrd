import { useContext } from 'react';

import EditorContext from '../../../context';
import type { SelectionState } from '../types';
import type { EditorContextType } from '../../editorContextTypes';

const SelectionMessages = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;

  return t(`Editor.tools.select-items.help.${state.selectionState.type}-selection`).toString();
};

export default SelectionMessages;
