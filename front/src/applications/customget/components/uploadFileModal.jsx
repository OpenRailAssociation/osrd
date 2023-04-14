import React, { useContext, useState } from 'react';
import PropTypes from 'prop-types';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { useTranslation } from 'react-i18next';

import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

function UploadFileModal(props) {
  const { t } = useTranslation(['customget', 'translation']);
  const [selectedFile, setSelectedFile] = useState();
  const [isValid, setIsValid] = useState('');
  const { closeModal } = useContext(ModalContext);
  const { handleSubmit } = props;

  const validateFile = async (fileToValidate) => {
    if (fileToValidate.type !== 'application/json') {
      return t('customget:notJSONFormat');
    }
    if (fileToValidate.size === 0) {
      return t('customget:emptyFile');
    }
    try {
      JSON.parse(await fileToValidate.text());
    } catch (e) {
      return t('customget:badJSON');
    }
    return true;
  };

  const handleSelect = async (event) => {
    const status = await validateFile(event.target.files[0]);
    setIsValid(status);
    if (status === true) {
      setSelectedFile(event.target.files[0]);
    }
  };

  return (
    <>
      <ModalBodySNCF>
        <>
          <div className="h1 modal-title text-center mb-4">
            <i className="icons-download text-primary" aria-hidden="true" />
          </div>
          <input type="file" name="file" onChange={handleSelect} accept=".json" />
          <div className="text-danger">{isValid}</div>
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
                {t('translation:common:cancel')}
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className={`btn btn-block btn-sm btn-primary ${isValid !== true ? 'disabled' : ''}`}
                onClick={() => handleSubmit(selectedFile)}
              >
                {t('translation:common:download')}
              </button>
            </div>
          </div>
        </div>
      </ModalFooterSNCF>
    </>
  );
}

UploadFileModal.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
};

export default UploadFileModal;
