import React, { useCallback, useRef } from 'react';

import { useTranslation } from 'react-i18next';
import { BiLockAlt } from 'react-icons/bi';
import { useSelector } from 'react-redux';

import icon from 'assets/pictures/components/train.svg';
import type {
  Comfort,
  LightRollingStockWithLiveries,
  RollingStockWithLiveries,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import RollingStock2Img from 'modules/rollingStock/components/RollingStock2Img';
import {
  comfort2pictogram,
  RollingStockInfo,
} from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import RollingStockModal from 'modules/rollingStock/components/RollingStockSelector/RollingStockModal';
import { updateCategory } from 'reducers/osrdconf/operationalStudiesConf';
import { getCategory } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import { useAppDispatch } from 'store';

type RollingStockProps = {
  rollingStockId: number | undefined;
  condensed?: boolean;
  rollingStockSelected?: RollingStockWithLiveries;
  rollingStockComfort: Comfort;
  image?: React.JSX.Element;
  onSelectRollingStock: (rollingStockId: number, comfort: Comfort) => void;
};

const RollingStockSelector = ({
  rollingStockId,
  condensed,
  rollingStockSelected,
  rollingStockComfort,
  image,
  onSelectRollingStock,
}: RollingStockProps) => {
  const dispatch = useAppDispatch();
  const currentCategory = useSelector(getCategory);
  const { openModal, closeModal } = useModal();

  const ref2scroll = useRef<HTMLDivElement>(null);
  const selectRollingStock = useCallback(
    (newRollingStock: LightRollingStockWithLiveries, comfort: Comfort) => {
      if (!currentCategory && newRollingStock.primary_category) {
        dispatch(
          updateCategory({
            main_category: newRollingStock.primary_category,
          })
        );
      }

      onSelectRollingStock(newRollingStock.id, comfort);
      closeModal();
    },
    [onSelectRollingStock, currentCategory]
  );

  const { t } = useTranslation();

  return (
    <div className="osrd-config-item mb-2">
      <div
        className="osrd-config-item-container osrd-config-item-clickable"
        data-testid="rollingstock-selector"
        onClick={() => {
          openModal(
            <RollingStockModal
              rollingStockId={rollingStockId}
              ref2scroll={ref2scroll}
              onSelectRollingStock={selectRollingStock}
            />,
            'lg'
          );
        }}
        role="button"
        tabIndex={0}
      >
        {rollingStockSelected !== undefined && rollingStockSelected !== null ? (
          <div
            className="rollingstock-selector-minicard"
            data-testid="rollingstock-selector-minicard"
          >
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
                  <span
                    data-testid="rollingstock-info-comfort"
                    className="rollingstock-info-comfort text-uppercase small"
                  >
                    <span className="text-uppercase font-weight-bold">
                      {t('rollingStock.comfort')}
                    </span>
                    <span className="mx-2">{comfort2pictogram(rollingStockComfort)}</span>
                    <span data-testid="selected-comfort-type-info">
                      {t(`rollingStock.comfortTypes.${rollingStockComfort}`)}
                    </span>
                  </span>
                  {rollingStockSelected.locked && (
                    <span>
                      <BiLockAlt />
                    </span>
                  )}
                  <span className="rollingstock-info-end" data-testid="selected-rolling-stock-info">
                    {rollingStockSelected.name}
                  </span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div data-testid="rollingstock-selector-empty" className="d-flex align-items-center">
            <img width="32px" className="mr-2" src={icon} alt="infraIcon" />
            {t('rollingStock.rollingstockChoice')}
          </div>
        )}
      </div>
    </div>
  );
};

export default RollingStockSelector;
