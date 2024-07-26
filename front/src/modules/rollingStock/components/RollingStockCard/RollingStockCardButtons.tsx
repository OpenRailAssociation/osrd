import React, { useContext, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import type { Option } from 'common/BootstrapSNCF/OptionsSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { comfort2pictogram } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import { useAppDispatch } from 'store';

interface RollingStockCardButtonsProps {
  id: number;
  curvesComfortList: string[];
  setOpenedRollingStockCardId: (openCardId: number | undefined) => void;
}

const RollingStockCardButtons = ({
  id,
  curvesComfortList,
  setOpenedRollingStockCardId,
}: RollingStockCardButtonsProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['rollingstock']);
  const { closeModal } = useContext(ModalContext);

  const { getRollingStockComfort } = useOsrdConfSelectors();
  const currentComfortInStore = useSelector(getRollingStockComfort);
  const [comfort, setComfort] = useState('STANDARD');

  const { updateRollingStockComfortV2, updateRollingStockID } = useOsrdConfActions();

  const selectRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    dispatch(updateRollingStockID(id));
    dispatch(
      updateRollingStockComfortV2(
        comfort !== 'AC' ? (comfort as TrainScheduleBase['comfort']) : 'AIR_CONDITIONING'
      )
    );
    closeModal();
  };

  const comfortOptions = useMemo(() => {
    const options: Option[] = [{ value: 'STANDARD', label: t('comfortTypes.STANDARD') }];
    if (curvesComfortList.includes('HEATING')) {
      options.push({
        value: 'HEATING',
        label: (
          <span
            data-testid="comfort-heating-button"
            className="rollingstock-footer-button-with-picto"
          >
            {comfort2pictogram('HEATING')} {t('comfortTypes.HEATING')}
          </span>
        ),
      });
    }
    if (curvesComfortList.includes('AC')) {
      options.push({
        value: 'AC',
        label: (
          <span data-testid="comfort-ac-button" className="rollingstock-footer-button-with-picto">
            {comfort2pictogram('AC')} {t('comfortTypes.AC')}
          </span>
        ),
      });
    }
    return options;
  }, [curvesComfortList]);

  useEffect(() => {
    if (curvesComfortList.includes(currentComfortInStore)) {
      setComfort(currentComfortInStore);
    }
  }, [currentComfortInStore]);

  return (
    <div className="rollingstock-footer-buttons">
      {curvesComfortList.length > 1 && (
        <OptionsSNCF
          onChange={(e) => setComfort(e.target.value)}
          options={comfortOptions}
          name="comfortChoice"
          selectedValue={comfort}
          sm
        />
      )}
      <button type="button" className="ml-2 btn btn-primary btn-sm" onClick={selectRollingStock}>
        {t('selectRollingStock')}
      </button>
    </div>
  );
};

export default RollingStockCardButtons;
