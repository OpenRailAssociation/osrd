import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { sec2time } from 'utils/timeManipulation';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export default function TrainListModal(props) {
  const { t } = useTranslation(['simulation']);
  const { simulation } = useSelector((state) => state.osrdsimulation);
  const { trainIDX } = props;
  return simulation.trains[trainIDX] ? (
    <ModalSNCF
      htmlID="trainlist-modal"
    >
      <ModalHeaderSNCF>
        {t('ModalEdit')}
      </ModalHeaderSNCF>
      <ModalBodySNCF>
        <InputSNCF
          type="text"
          id="trainlist-modal-name"
          onChange={() => {}}
          value={simulation.trains[trainIDX].name}
        />
        <InputSNCF
          type="time"
          id="trainlist-modal-starttime"
          onChange={() => {}}
          value={sec2time(simulation.trains[trainIDX].stops[0].time)}
        />
      </ModalBodySNCF>
    </ModalSNCF>
  ) : null;
}

TrainListModal.propTypes = {
  trainIDX: PropTypes.number.isRequired,
};
