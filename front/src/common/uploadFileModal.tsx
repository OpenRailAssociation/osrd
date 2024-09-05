import { useCallback, useContext, useState } from 'react';

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
  const { t } = useTranslation(['translation']);
  const { closeModal } = useContext(ModalContext);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [isValid, setIsValid] = useState<string | undefined>(undefined);

  const validateFile = useCallback(
    async (fileToValidate: File): Promise<string | undefined> => {
      if (fileToValidate.type !== 'application/json') {
        return t('jsonUpload.notJSONFormat').toString();
      }
      if (fileToValidate.size === 0) {
        return t('jsonUpload.emptyFile').toString();
      }
      try {
        JSON.parse(await fileToValidate.text());
      } catch (e) {
        return t('jsonUpload.badJSON').toString();
      }
      return undefined;
    },
    [t]
  );

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
            accept=".json"
            onChange={async (e) => {
              if (e.target.files && e.target.files.length > 0) {
                const error = await validateFile(e.target.files[0]);
                setIsValid(error);
                if (isNil(error)) {
                  setSelectedFile(e.target.files[0]);
                }
              } else {
                setSelectedFile(undefined);
                setIsValid(undefined);
              }
            }}
          />
          {!isNil(isValid) && <div className="text-danger">{isValid}</div>}
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
                {t('common.cancel')}
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                disabled={isNil(selectedFile) || !isNil(isValid)}
                className="btn btn-block btn-sm btn-primary"
                onClick={() => {
                  if (selectedFile) handleSubmit(selectedFile);
                }}
              >
                {t('common.download')}
              </button>
            </div>
          </div>
        </div>
      </ModalFooterSNCF>
    </>
  );
};

export default UploadFileModal;
