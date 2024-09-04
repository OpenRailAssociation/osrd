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
  const { t } = useTranslation(['operationalStudies/importTrainSchedule']);
  const { closeModal } = useContext(ModalContext);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [isValid, setIsValid] = useState<string | undefined>(undefined);

  const parseXML = (xmlString: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror');
      if (parserError.length > 0) {
        throw new Error('Invalid XML');
      }
      return undefined;
    } catch (error) {
      return t('errorMessages.errorInvalidXMLFormat').toString();
    }
  };
  // TODO : create the translation keys
  const validateFile = useCallback(
    async (fileToValidate: File): Promise<string | undefined> => {
      if (fileToValidate.size === 0) {
        return t('errorMessages.errorEmptyFile').toString();
      }
      if (fileToValidate.type === 'application/json') {
        try {
          JSON.parse(await fileToValidate.text());
        } catch (e) {
          return t('errorMessages.errorInvalidJSONFormat').toString();
        }
      } else if (
        fileToValidate.type === 'application/railml' ||
        fileToValidate.name.endsWith('.railml')
      ) {
        const fileContent = await fileToValidate.text();
        const xmlError = parseXML(fileContent);
        if (xmlError) {
          return xmlError;
        }
      } else {
        return t('errorMessages.errorUnsupportedFileType').toString();
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
            accept=".json,.xml,.railml"
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
                {t('cancel')}
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
