import React, { useEffect, useState } from 'react';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalHeaderSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalHeaderSNCF';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import PropTypes from 'prop-types';
import { sec2time } from 'utils/timeManipulation';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

export default function TrainListModal(props) {
  const { t } = useTranslation(['simulation']);
  const { simulation } = useSelector((state) => state.osrdsimulation);
  const { trainIDX } = props;
  return simulation.present.trains[trainIDX] ? (
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
          value={simulation.present.trains[trainIDX].name}
        />
        <InputSNCF
          type="time"
          id="trainlist-modal-starttime"
          onChange={() => {}}
          value={sec2time(simulation.present.trains[trainIDX].stops[0].time)}
        />
      </ModalBodySNCF>
    </ModalSNCF>
  ) : null;
}

TrainListModal.propTypes = {
  trainIDX: PropTypes.number.isRequired,
};
