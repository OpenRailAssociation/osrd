import { useContext } from 'react';

import { isEqual } from 'lodash';

import EditorContext from 'applications/editor/context';
import type { PointEditionState } from 'applications/editor/tools/pointEdition/types';
import type { EditorContextType } from 'applications/editor/types';
import type { EditorEntity } from 'applications/editor/typesEditorEntity';
import { NULL_GEOMETRY } from 'types';

const PointEditionMessages = () => {
  const { t, state } = useContext(EditorContext) as EditorContextType<
    PointEditionState<EditorEntity>
  >;

  if (!state.entity.geometry || isEqual(state.entity.geometry, NULL_GEOMETRY)) {
    return state.nearestPoint
      ? t(`Editor.tools.point-edition.help.stop-dragging-on-line`).toString()
      : t(`Editor.tools.point-edition.help.stop-dragging-no-line`).toString();
  }

  return t(`Editor.tools.point-edition.help.start-dragging`).toString();
};

export default PointEditionMessages;
