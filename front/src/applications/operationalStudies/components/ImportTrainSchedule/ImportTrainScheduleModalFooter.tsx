import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { useNavigate } from 'react-router-dom';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

const ImportTrainScheduleModalFooter = ({
  status,
}: {
  status: {
    uicComplete: boolean;
    pathFindingDone: boolean;
    trainSchedulesDone: boolean;
    success: boolean;
  };
}) => {
  const { t } = useTranslation(['translation', 'operationalStudies/importTrainSchedule']);
  const { closeModal } = useContext(ModalContext);
  const navigate = useNavigate();
  return (
    <ModalFooterSNCF>
      <div className="w-100">
        {Object.values(status).every((el) => el) && (
          <button
            type="button"
            className="btn text-wrap btn-success mb-1 btn-block"
            onClick={() => {
              closeModal();
              navigate('/stdcm');
            }}
          >
            {t('operationalStudies/importTrainSchedule:goToSTDCM')}
          </button>
        )}
        <button onClick={closeModal} type="button" className="btn btn-sm btn-secondary btn-block">
          {t('translation:common.close')}
        </button>
      </div>
    </ModalFooterSNCF>
  );
};

export default ImportTrainScheduleModalFooter;
