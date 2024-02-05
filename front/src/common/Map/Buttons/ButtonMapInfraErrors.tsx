import React, { useState } from 'react';
import { BsExclamationOctagon } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from 'store';
import { type EditorState, editorSliceActions } from 'reducers/editor';
import type { Layer } from 'applications/editor/consts';
import cx from 'classnames';

interface ButtonMapInfraErrorsProps {
  editorState: EditorState;
}

const ButtonMapInfraErrors: React.FC<ButtonMapInfraErrorsProps> = ({ editorState }) => {
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
