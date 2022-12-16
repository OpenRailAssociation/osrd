import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalFooterSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalFooterSNCF';
import RollingStock from 'applications/osrd/components/RollingStock/RollingStock';
import icon from 'assets/pictures/components/train.svg';
import RollingStock2Img from 'applications/osrd/components/RollingStock/RollingStock2Img';
import {
  comfort2pictogram,
  enhanceData,
  RollingStockInfos,
} from 'applications/osrd/components/RollingStock/RollingStockHelpers';
import { getRollingStockID, getRollingStockComfort } from 'reducers/osrdconf/selectors';

const ROLLINGSTOCK_URL = '/rolling_stock';

export default function RollingStockSelector() {
  const rollingStockID = useSelector(getRollingStockID);
  const rollingStockComfort = useSelector(getRollingStockComfort);

  const { t } = useTranslation(['translation', 'rollingstock']);
  const [rollingStockSelected, setRollingStockSelected] = useState(undefined);
  const ref2scroll = useRef(null);

  const getRollingStock = async () => {
    try {
      const rollingStock = await get(`${ROLLINGSTOCK_URL}/${rollingStockID}/`);
      setRollingStockSelected(enhanceData([rollingStock])[0]);
    } catch (e) {
      console.log('ERROR', e);
    }
  };

  const scroll2ref = () => {
    if (rollingStockID !== undefined) {
      // Because of modal waiting for displaying, have to set a timeout to correctly scroll to ref
      // BUT finally, it's great, it creates a micro-interaction (smooth scroll) !
      setTimeout(() => {
        ref2scroll.current?.scrollIntoView({ behavior: 'smooth' });
      }, 1000);
    }
  };

  useEffect(() => {
    if (rollingStockID !== undefined) {
      getRollingStock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollingStockID]);

  return (
    <>
      <div className="osrd-config-item mb-2">
        <div
          className="osrd-config-item-container osrd-config-item-clickable"
          data-toggle="modal"
          data-target="#rollingStockModal"
          onClick={scroll2ref}
          role="button"
          tabIndex={0}
        >
          {rollingStockSelected !== undefined ? (
            <div className="rollingstock-minicard">
              <RollingStockInfos data={rollingStockSelected} showMiddle={false} showEnd={false} />
              <div className="rollingstock-container-img">
                <div className="rollingstock-img">
                  <RollingStock2Img name={rollingStockSelected.name} />
                </div>
              </div>
              <div className="rollingstock-minicard-end">
                <span className="rollingstock-infos-comfort text-uppercase small">
                  <span className="text-uppercase font-weight-bold">
                    {`${t('rollingstock:comfort')} `}
                  </span>
                  <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
                  {`${t(`rollingstock:comfortTypes.${rollingStockComfort}`)}`}
                </span>
                <RollingStockInfos
                  data={rollingStockSelected}
                  showMiddle={false}
                  showSeries={false}
                />
              </div>
            </div>
          ) : (
            <div className="d-flex align-items-center">
              <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
              {t('rollingstock:rollingstockChoice')}
            </div>
          )}
        </div>
      </div>
      <ModalSNCF htmlID="rollingStockModal" size="lg">
        <ModalBodySNCF>
          <RollingStock ref2scroll={ref2scroll} />
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
