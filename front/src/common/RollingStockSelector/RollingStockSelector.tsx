import React, { useRef } from 'react';
import RollingStockModal from 'common/RollingStockSelector/RollingStockModal';
import icon from 'assets/pictures/components/train.svg';
import {
  comfort2pictogram,
  RollingStockInfos,
} from 'common/RollingStockSelector/RollingStockHelpers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { RollingStock } from 'common/api/osrdEditoastApi';

type RollingStockProps = {
  rollingStockSelected?: RollingStock;
  rollingStockComfort?: string;
  image?: JSX.Element;
  comfort?: string;
  comfortType?: string;
  choice?: string;
  condensed?: boolean;
};

const RollingStockSelector = ({
  rollingStockSelected,
  rollingStockComfort,
  image,
  comfort,
  comfortType,
  choice,
  condensed,
}: RollingStockProps) => {
  const { openModal } = useModal();

  const ref2scroll: React.RefObject<HTMLInputElement> = useRef<HTMLInputElement>(null);

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
          <div className="rollingstock-minicard">
            {condensed ? (
              <div className="d-flex align-items-center font-weight-bold">
                <RollingStockInfos
                  data={rollingStockSelected}
                  showMiddle={false}
                  showSeries={false}
                />
                <div className="rollingstock-container-img ml-4">
                  <div className="rollingstock-img d-flex align-items-center">{image}</div>
                </div>
                <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
              </div>
            ) : (
              <>
                <RollingStockInfos data={rollingStockSelected} showMiddle={false} showEnd={false} />
                <div className="rollingstock-container-img">
                  <div className="rollingstock-img">{image}</div>
                </div>
                <div className="rollingstock-minicard-end">
                  <span className="rollingstock-infos-comfort text-uppercase small">
                    <span className="text-uppercase font-weight-bold">{comfort}</span>
                    <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
                    {comfortType}
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
            {choice}
          </div>
        )}
      </div>
    </div>
  );
};

export default RollingStockSelector;
