import { useContext, useId, useState } from 'react';

import { Download } from '@osrd-project/ui-icons';
import { isNil } from 'lodash';
import { useTranslation } from 'react-i18next';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

type UploadFileModalProps = {
  handleSubmit: (file: File) => void;
};

const UploadFileModal = ({ handleSubmit }: UploadFileModalProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'importTrains' });
  const { closeModal } = useContext(ModalContext);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const inputId = useId();

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles);
      setSelectedFile(newFiles[0]);
    }
  };

  return (
    <>
      <ModalBodySNCF>
        <label
          htmlFor={inputId}
          className="input-file"
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
        >
          <div className="text-primary text-center">
            <Download />
          </div>

          <span className="">
            {selectedFile ? t('selectedFile', { fileName: selectedFile.name }) : t('chooseFile')}
          </span>

          <input
            id={inputId}
            type="file"
            name="file"
            hidden
            accept=".json,.txt,.xml,.railml"
            onChange={(e) =>
              setSelectedFile(
                e.target.files && e.target.files.length > 0 ? e.target.files[0] : undefined
              )
            }
          />
        </label>
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
