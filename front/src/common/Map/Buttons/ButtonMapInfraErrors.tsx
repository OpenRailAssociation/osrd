import React, { useState } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { BsExclamationOctagon } from 'react-icons/bs';

import type { Layer } from 'applications/editor/consts';
import { type EditorState, editorSliceActions } from 'reducers/editor';
import { useAppDispatch } from 'store';

interface ButtonMapInfraErrorsProps {
  editorState: EditorState;
}

const ButtonMapInfraErrors = ({ editorState }: ButtonMapInfraErrorsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('translation');
  const [isActive, setIsActive] = useState(true);

  const toggleInfraErrors = () => {
    const newSet = new Set<Layer>(editorState.editorLayers);
    if (newSet.has('errors')) newSet.delete('errors');
    else newSet.add('errors');
    dispatch(editorSliceActions.selectLayers(newSet));
    setIsActive(!isActive);
  };

  return (
    <button
      type="button"
      className={cx('editor-btn btn-rounded', {
        active: isActive,
      })}
      aria-label={t('common.toggleInfraErrors')}
      title={t('common.toggleInfraErrors')}
      onClick={toggleInfraErrors}
    >
      <BsExclamationOctagon />
    </button>
  );
};

export default ButtonMapInfraErrors;
