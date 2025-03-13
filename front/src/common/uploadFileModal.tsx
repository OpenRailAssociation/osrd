import { useContext, useState } from 'react';

import { Download } from '@osrd-project/ui-icons';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

interface UploadFileModalProps {
  handleSubmit: (file: File) => void;
}

const UploadFileModal = ({ handleSubmit }: UploadFileModalProps) => {
  const { t } = useTranslation(['operationalStudies/importTimetableItem']);
  const { closeModal } = useContext(ModalContext);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  return (
    <>
      <ModalBodySNCF>
        <>
          <div className="h1 modal-title text-center mb-4">
            <span className="text-primary">
              <Download />
            </span>
          </div>
          <input
            type="file"
            name="file"
            accept=".json,.txt,.xml,.railml"
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                setSelectedFile(e.target.files[0]);
              } else {
                setSelectedFile(undefined);
              }
            }}
          />
        </>
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="w-100">
          <div className="row">
            <div className="col-6">
              <button
                type="button"
                className="btn btn-block btn-sm btn-secondary"
                onClick={closeModal}
              >
                {t('cancel')}
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                disabled={isNil(selectedFile)}
                className="btn btn-block btn-sm btn-primary"
                onClick={() => {
                  if (selectedFile) handleSubmit(selectedFile);
                }}
              >
                {t('download')}
              </button>
            </div>
          </div>
        </div>
      </ModalFooterSNCF>
    </>
  );
};

export default UploadFileModal;
