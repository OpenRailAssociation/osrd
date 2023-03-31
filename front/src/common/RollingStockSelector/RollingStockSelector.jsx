import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import RollingStockModal from 'common/RollingStockSelector/RollingStockModal';
import icon from 'assets/pictures/components/train.svg';
import RollingStock2Img from 'common/RollingStockSelector/RollingStock2Img';
import {
  comfort2pictogram,
  RollingStockInfos,
} from 'common/RollingStockSelector/RollingStockHelpers';
import { getRollingStockID, getRollingStockComfort } from 'reducers/osrdconf/selectors';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';

const ROLLINGSTOCK_URL = '/rolling_stock';

export default function RollingStockSelector({ condensed }) {
  const { openModal } = useModal();
  const rollingStockID = useSelector(getRollingStockID);
  const rollingStockComfort = useSelector(getRollingStockComfort);

  const { t } = useTranslation(['translation', 'rollingstock']);
  const [rollingStockSelected, setRollingStockSelected] = useState(undefined);
  const ref2scroll = useRef(null);

  const getRollingStock = async () => {
    try {
      const rollingStock = await get(`${ROLLINGSTOCK_URL}/${rollingStockID}/`);
      setRollingStockSelected(rollingStock);
    } catch (e) {
      /* empty */
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
    <div className="osrd-config-item mb-2">
      <div
        className="osrd-config-item-container osrd-config-item-clickable"
        data-testid="rollingstock-selector"
        onClick={() => {
          scroll2ref();
          openModal(<RollingStockModal ref2scroll={ref2scroll} />, 'lg');
        }}
        role="button"
        tabIndex={0}
      >
        {rollingStockSelected !== undefined ? (
          <div className="rollingstock-minicard">
            {condensed ? (
              <div className="d-flex align-items-center font-weight-bold">
                <RollingStockInfos
                  data={rollingStockSelected}
                  showMiddle={false}
                  showSeries={false}
                />
                <div className="rollingstock-container-img ml-4">
                  <div className="rollingstock-img d-flex align-items-center">
                    <RollingStock2Img rollingStock={rollingStockSelected} />
                  </div>
                </div>
                <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
              </div>
            ) : (
              <>
                <RollingStockInfos data={rollingStockSelected} showMiddle={false} showEnd={false} />
                <div className="rollingstock-container-img">
                  <div className="rollingstock-img">
                    <RollingStock2Img rollingStock={rollingStockSelected} />
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
              </>
            )}
          </div>
        ) : (
          <div className="d-flex align-items-center">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            {t('rollingstock:rollingstockChoice')}
          </div>
        )}
      </div>
    </div>
  );
}

RollingStockSelector.propTypes = {
  condensed: PropTypes.bool,
};

RollingStockSelector.defaultProps = {
  condensed: false,
};
