import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { updateInfraID } from 'reducers/osrdconf';
import nextId from 'react-id-generator';
import { datetime2string } from 'utils/timeManipulation';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';

export default function InfraSelectorModal(props) {
  const dispatch = useDispatch();
  const { infrasList } = props;
  const { t } = useTranslation(['translation', 'osrdconf']);

  return (
    <ModalSNCF htmlID="infra-selector-modal">
      <ModalHeaderSNCF>
        {t('osrdconf:infrachoose')}
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <>
          <div className="mb-3 osrd-config-infraselector">
            {(infrasList !== undefined) ? (
              infrasList.results.map((infra) => (
                <div
                  role="button"
                  tabIndex="-1"
                  onClick={() => dispatch(updateInfraID(infra.id))}
                  key={nextId()}
                  data-dismiss="modal"
                  className="osrd-config-infraselector-item"
                >
                  <div className="d-flex align-items-center">
                    <div className="text-primary small mr-2">
                      {infra.id}
                    </div>
                    <div className="flex-grow-1">{infra.name}</div>
                    <div className="small">
                      {datetime2string(infra.modified)}
                    </div>
                  </div>
                </div>
              ))) : null }
          </div>
          <div className="d-flex">
            <button className="btn btn-secondary flex-fill mr-2" type="button" data-dismiss="modal">
              {t('translation:common.cancel')}
            </button>
          </div>
        </>
      </ModalBodySNCF>
    </ModalSNCF>
  );
}

InfraSelectorModal.propTypes = {
  infrasList: PropTypes.object.isRequired,
};
