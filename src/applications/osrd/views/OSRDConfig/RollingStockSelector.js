import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import RollingStock from 'applications/osrd/components/RollingStock/RollingStock';
import icon from 'assets/pictures/train.svg';

const ROLLINGSTOCK_URL = '/rolling_stock';

export default function RollingStockSelector() {
  const { rollingStockID } = useSelector((state) => state.osrdconf);
  const { t } = useTranslation(['translation', 'osrdconf']);
  const [rollingStockSelected, setRollingStockSelected] = useState(undefined);

  const getRollingStock = async () => {
    try {
      const rollingStock = await get(`${ROLLINGSTOCK_URL}/${rollingStockID}/`);
      setRollingStockSelected(rollingStock);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  useEffect(() => {
    if (rollingStockID !== undefined) {
      getRollingStock();
    }
  }, [rollingStockID]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container d-flex osrd-config-item-clickable"
          data-toggle="modal"
          data-target="#rollingStockModal"
        >
          <div className="h2 d-flex align-items-center">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            <span className="mr-2 text-muted">{t('osrdconf:rollingstock')}</span>
            {rollingStockSelected !== undefined ? (
              rollingStockSelected.name
            ) : (
              <span className="mr-2 text-muted text-italic">
                {t('osrdconf:noRollingStock')}
              </span>
            )}
          </div>
        </div>
      </div>
      <ModalSNCF htmlID="rollingStockModal" size="lg">
        <ModalBodySNCF>
          <RollingStock />
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
