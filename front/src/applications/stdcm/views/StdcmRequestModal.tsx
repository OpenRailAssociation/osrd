import { useTranslation } from 'react-i18next';
import ReactModal from 'react-modal';

import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import { Spinner } from 'common/Loaders';

export type StdcmRequestModalProps = {
  isOpen: boolean;
  cancelStdcmRequest: () => void;
};

const StdcmRequestModal = ({ isOpen, cancelStdcmRequest }: StdcmRequestModalProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <ReactModal
      isOpen={isOpen}
      id="stdcmRequestModal"
      className="modal-dialog-centered"
      style={{ overlay: { zIndex: 3 } }}
      ariaHideApp={false}
    >
      <div className="modal-dialog" role="document">
        <div className="modal-content">
          <ModalHeaderSNCF>
            <h1>{t('stdcmComputation')}</h1>
          </ModalHeaderSNCF>
          <ModalBodySNCF>
            <div className="d-flex flex-column text-center">
              <div className="d-flex align-items-center justify-content-center mb-3">
                <span className="mr-2">{t('pleaseWait')}</span>
                <Spinner />
              </div>

              <div className="text-center p-1">
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  onClick={cancelStdcmRequest}
                >
                  {t('cancelRequest')}
                  <span className="sr-only" aria-hidden="true">
                    {t('stdcm:cancelRequest')}
                  </span>
                </button>
              </div>
            </div>
          </ModalBodySNCF>
        </div>
      </div>
    </ReactModal>
  );
};

export default StdcmRequestModal;
