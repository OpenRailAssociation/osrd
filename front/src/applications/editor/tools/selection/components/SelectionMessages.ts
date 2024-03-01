import { useContext } from 'react';

import EditorContext from 'applications/editor/context';
import type { SelectionState } from 'applications/editor/tools/selection/types';
import type { EditorContextType } from 'applications/editor/types';

const SelectionMessages = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<SelectionState>;

  return t(`Editor.tools.select-items.help.${state.selectionState.type}-selection`).toString();
};

export default SelectionMessages;
