import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import TrainCompo from 'applications/osrd/components/TrainCompo/TrainCompo';
import TrainCompoCard from 'applications/osrd/components/TrainCompo/TrainCompoCard';
import icon from 'assets/pictures/train.svg';

export default function TrainCompoSelector() {
  const osrdconf = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div className="osrd-config-item-container d-flex">
          {osrdconf.trainCompo !== undefined && osrdconf.trainCompo.codenbengin !== undefined ? (
            <TrainCompoCard
              data={osrdconf.trainCompo}
              displayDetails={() => {}}
              active={false}
            />
          ) : (
            <div className="d-flex align-items-center flex-grow-1">
              <img width="32px" className="mr-1" src={icon} alt="infraIcon" />
              <span className="mr-2 text-muted text-italic">
                {t('osrdconf:noTrainCompo')}
              </span>
            </div>
          )}
          <button type="button" className="btn btn-sm btn-secondary" data-toggle="modal" data-target="#trainCompoModal">
            {t('osrdconf:chooseTrainCompo')}
            <i className="icons-itinerary-train ml-2" />
          </button>
        </div>
      </div>
      <ModalSNCF htmlID="trainCompoModal" optionalClasses="traincompo-modal">
        <ModalBodySNCF>
          <TrainCompo />
        </ModalBodySNCF>
        <ModalFooterSNCF>
          <div className="d-flex flex-row-reverse w-100">
            <button className="btn btn-secondary btn-sm" type="button" data-dismiss="modal">
              {t('translation:common.close')}
            </button>
          </div>
        </ModalFooterSNCF>
      </ModalSNCF>
    </>
  );
}
