import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { getEditorState } from 'reducers/editor/selectors';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import magicWandIcon from 'assets/pictures/magic_wand.svg';
import InfraErrorCorrectorModal from './InfraErrorCorrectorModal';

const InfraErrorCorrector = () => {
  const { t } = useTranslation();
  const { openModal } = useModal();
  const editorState = useSelector(getEditorState);
  const { total } = editorState.issues;

  return (
    <button
      type="button"
      title={t('Editor.nav.infra-error-corrector')}
      className="btn btn-sm p-1 shadow d-flex align-items-center justify-content-center"
      onClick={() => {
        openModal(<InfraErrorCorrectorModal />);
      }}
      disabled={total === 0}
    >
      <img src={magicWandIcon} alt="Magic wand" />
    </button>
  );
};

export default InfraErrorCorrector;
