import { useContext } from 'react';

import EditorContext from 'applications/editor/context';
import type { TrackSplitState } from 'applications/editor/tools/trackSplit/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

const TrackSplitMessages = () => {
  const { t, state } = useContext(EditorContext) as ExtendedEditorContextType<TrackSplitState>;
  switch (state.splitState.type) {
    case 'hoverPoint':
      return t('Editor.tools.track-split.help.hover').toString();
    case 'splitLine':
      return t('Editor.tools.track-split.help.split').toString();
    case 'movePoint':
      return t('Editor.tools.track-split.help.move').toString();
    default:
      return t('Editor.tools.track-split.help.default').toString();
  }
};

export default TrackSplitMessages;
