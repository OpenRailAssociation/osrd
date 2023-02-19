import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { useNavigate } from 'react-router-dom';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

export default function ImportTrainScheduleModalFooter(props) {
  const { status } = props;
  const { t } = useTranslation('translation', 'operationalStudies/importTrainSchedule');
  const { closeModal } = useContext(ModalContext);
  const navigate = useNavigate();
  return (
    <ModalFooterSNCF>
      <div>
        {Object.values(status).every((el) => el) ? (
          <div className="d-flex justify-content-between mb-2">
            <button
              type="button"
              className="btn text-wrap btn-success flex-grow-1 mr-1"
              onClick={() => {
                closeModal();
              }}
            >
              {t('operationalStudies/importTrainSchedule:goToSimulation')}
            </button>
            <button
              type="button"
              className="btn text-wrap btn-success flex-grow-1 ml-1"
              onClick={() => {
                closeModal();
                navigate('/stdcm');
              }}
            >
              {t('operationalStudies/importTrainSchedule:goToSTDCM')}
            </button>
          </div>
        ) : null}
        <button onClick={closeModal} type="button" className="btn btn-sm btn-secondary btn-block">
          {t('translation:common.close')}
        </button>
      </div>
    </ModalFooterSNCF>
  );
}

ImportTrainScheduleModalFooter.propTypes = {
  status: PropTypes.object.isRequired,
};
