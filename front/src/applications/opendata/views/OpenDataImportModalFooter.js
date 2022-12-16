import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import { useNavigate } from 'react-router-dom';

export default function OpenDataImportModalFooter(props) {
  const { status } = props;
  const { t } = useTranslation('translation', 'opendata');
  const navigate = useNavigate();
  return (
    <ModalFooterSNCF>
      <div>
        {Object.values(status).every((el) => el) ? (
          <div className="d-flex justify-content-between mb-2">
            <button
              data-dismiss="modal"
              type="button"
              className="btn text-wrap btn-success flex-grow-1 mr-1"
              onClick={() => navigate('/osrd/simulation')}
            >
              {t('opendata:goToSimulation')}
            </button>
            <button
              data-dismiss="modal"
              type="button"
              className="btn text-wrap btn-success flex-grow-1 ml-1"
              onClick={() => navigate('/stdcm')}
            >
              {t('opendata:goToSTDCM')}
            </button>
          </div>
        ) : null}
        <button data-dismiss="modal" type="button" className="btn btn-sm btn-secondary btn-block">
          {t('translation:common.close')}
        </button>
      </div>
    </ModalFooterSNCF>
  );
}

OpenDataImportModalFooter.propTypes = {
  status: PropTypes.object.isRequired,
};
