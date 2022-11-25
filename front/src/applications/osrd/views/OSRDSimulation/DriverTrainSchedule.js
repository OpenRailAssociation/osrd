import React, { useEffect, useState } from 'react';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import DriverTrainScheduleModal from 'applications/osrd/components/DriverTrainSchedule/DriverTrainScheduleModal';

const TRAINSCHEDULE_URL = '/train_schedule';
const ROLLINGSTOCK_URL = '/rolling_stock';

export default function DriverTrainSchedule(props) {
  const { t } = useTranslation(['drivertrainschedule', 'translation', 'osrdconf', 'rollingstock']);
  const { data } = props;
  const [rollingStockSelected, setRollingStockSelected] = useState(undefined);

  const getRollingStock = async () => {
    try {
      const trainScheduleDetails = await get(`${TRAINSCHEDULE_URL}/${data.id}/`);
      try {
        const rollingStock = await get(
          `${ROLLINGSTOCK_URL}/${trainScheduleDetails.rolling_stock}/`
        );
        setRollingStockSelected(rollingStock);
      } catch (e) {
        console.log('ERROR', e);
      }
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    if (data) getRollingStock();
  }, [data]);

  return (
    <ModalSNCF className="modal-drivertrainschedule" htmlID="driverTrainScheduleModal" size="xl">
      <ModalBodySNCF>
        {data && rollingStockSelected ? (
          <DriverTrainScheduleModal data={data} rollingStockSelected={rollingStockSelected} />
        ) : (
          ''
        )}
      </ModalBodySNCF>
      <ModalFooterSNCF>
        <div className="d-flex flex-row-reverse w-100">
          <button className="btn btn-secondary btn-sm" type="button" data-dismiss="modal">
            {t('translation:common.close')}
          </button>
        </div>
      </ModalFooterSNCF>
    </ModalSNCF>
  );
}

DriverTrainSchedule.propTypes = {
  data: PropTypes.object,
};

DriverTrainSchedule.defaultProps = {
  data: undefined,
};
