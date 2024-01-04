import React, { useRef } from 'react';
import RollingStockModal from 'modules/rollingStock/components/RollingStockSelector/RollingStockModal';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import icon from 'assets/pictures/components/train.svg';
import {
  comfort2pictogram,
  RollingStockInfo,
} from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { RollingStockComfortType, RollingStockWithLiveries } from 'common/api/osrdEditoastApi';
import { useTranslation } from 'react-i18next';

type RollingStockProps = {
  condensed?: boolean;
  rollingStockSelected?: RollingStockWithLiveries;
  rollingStockComfort: RollingStockComfortType;
  image?: JSX.Element;
};

const RollingStockSelector = ({
  condensed,
  rollingStockSelected,
  rollingStockComfort,
  image,
}: RollingStockProps) => {
  const { openModal } = useModal();

  const ref2scroll = useRef<HTMLDivElement>(null);

  const { t } = useTranslation('rollingstock');

  return (
    <div className="osrd-config-item mb-2">
      <div
        className="osrd-config-item-container osrd-config-item-clickable"
        data-testid="rollingstock-selector"
        onClick={() => {
          openModal(<RollingStockModal ref2scroll={ref2scroll} />, 'lg');
        }}
        role="button"
        tabIndex={0}
      >
        {rollingStockSelected !== undefined && rollingStockSelected !== null ? (
          <div className="rollingstock-selector-minicard">
            {condensed ? (
              <div className="d-flex align-items-center font-weight-bold">
                <RollingStockInfo
                  rollingStock={rollingStockSelected}
                  showMiddle={false}
                  showSeries={false}
                />
                <div className="rollingstock-container-img ml-4">
                  <div className="rollingstock-img d-flex align-items-center">
                    {image || <RollingStock2Img rollingStock={rollingStockSelected} />}
                  </div>
                </div>
                <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
              </div>
            ) : (
              <>
                <RollingStockInfo
                  rollingStock={rollingStockSelected}
                  showMiddle={false}
                  showEnd={false}
                />
                <div className="rollingstock-container-img">
                  <div className="rollingstock-img">
                    {image || <RollingStock2Img rollingStock={rollingStockSelected} />}
                  </div>
                </div>
                <div className="rollingstock-minicard-end">
                  <span className="rollingstock-info-comfort text-uppercase small">
                    <span className="text-uppercase font-weight-bold">{t('comfort')}</span>
                    <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
                    {t(`comfortTypes.${rollingStockComfort}`)}
                  </span>
                  <RollingStockInfo
                    rollingStock={rollingStockSelected}
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
            {t('rollingstockChoice')}
          </div>
        )}
      </div>
    </div>
  );
};

export default RollingStockSelector;
