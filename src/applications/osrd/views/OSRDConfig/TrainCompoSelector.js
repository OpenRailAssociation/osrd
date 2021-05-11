import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import TrainCompo from 'applications/osrd/components/TrainCompo/TrainCompo';
import TrainCompoCard from 'applications/osrd/components/TrainCompo/TrainCompoCard';

export default function TrainCompoSelector(props) {
  const osrdconf = useSelector((state) => state.osrdconf);
  const { modalID } = props;
  const { t } = useTranslation();

  const displayChosenCompo = () => (
    <TrainCompoCard
      data={osrdconf.trainCompo}
      displayDetails={() => {}}
      active={false}
    />
  );

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container">
          {osrdconf.trainCompo !== undefined && osrdconf.trainCompo.codenbengin !== undefined ? (
            displayChosenCompo()
          ) : (
            <span className="mr-2 text-muted text-italic">
              {t('osrd.config.noTrainCompo')}
            </span>
          )}
          <button type="button" className="btn btn-sm btn-secondary ml-auto" data-toggle="modal" data-target={`#${modalID}`}>
            {t('osrd.config.chooseTrainCompo')}
            <i className="icons-itinerary-train ml-2" />
          </button>
        </div>
      </div>
      <ModalSNCF htmlID={modalID} optionalClasses="traincompo-modal">
        <ModalBodySNCF>
          <TrainCompo />
        </ModalBodySNCF>
        <ModalFooterSNCF>
          <div className="d-flex flex-row-reverse w-100">
            <button className="btn btn-secondary btn-sm" type="button" data-dismiss="modal">
              {t('common.close')}
            </button>
          </div>
        </ModalFooterSNCF>
      </ModalSNCF>
    </>
  );
}

TrainCompoSelector.propTypes = {
  modalID: PropTypes.string.isRequired,
};
