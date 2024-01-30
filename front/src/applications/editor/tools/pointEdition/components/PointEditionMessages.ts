import { isEqual } from 'lodash';
import { useContext } from 'react';

import { EditorEntity, NULL_GEOMETRY } from 'types';

import EditorContext from '../../../context';
import { EditorContextType } from '../../editorContextTypes';
import { PointEditionState } from '../types';

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
