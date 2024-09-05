import { Wand } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getEditorState } from 'reducers/editor/selectors';

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
      className="btn btn-sm py-1 px-2 shadow d-flex align-items-center justify-content-center"
      onClick={() => {
        openModal(<InfraErrorCorrectorModal />);
      }}
      disabled={total === 0}
      aria-label="Magic Wand"
    >
      <Wand />
    </button>
  );
};

export default InfraErrorCorrector;
