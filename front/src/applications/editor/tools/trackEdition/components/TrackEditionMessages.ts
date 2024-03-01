import { useContext } from 'react';

import EditorContext from 'applications/editor/context';
import type { TrackEditionState } from 'applications/editor/tools/trackEdition/types';
import type { ExtendedEditorContextType } from 'applications/editor/types';

const TrackEditionMessages = () => {
  const { t, state } = useContext(EditorContext) as ExtendedEditorContextType<TrackEditionState>;

  switch (state.editionState.type) {
    case 'addPoint':
      if (!state.anchorLinePoints) return t('Editor.tools.track-edition.help.add-point').toString();
      return t('Editor.tools.track-edition.help.add-anchor-point').toString();
    case 'movePoint':
      if (!state.editionState.draggedPointIndex)
        return t('Editor.tools.track-edition.help.move-point').toString();
      return t('Editor.tools.track-edition.help.move-point-end').toString();
    case 'deletePoint':
      return t('Editor.tools.track-edition.help.delete-point').toString();
    default:
      return null;
  }
};

export default TrackEditionMessages;
