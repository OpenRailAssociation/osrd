import React, { useContext, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { RollingStockComfortType, TrainScheduleBase } from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import type { Option } from 'common/BootstrapSNCF/OptionsSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { comfort2pictogram } from 'modules/rollingStock/components/RollingStockSelector/RollingStockHelpers';
import { getTrainScheduleV2Activated } from 'reducers/user/userSelectors';
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
  const trainScheduleV2Activated = useSelector(getTrainScheduleV2Activated);
  const [comfort, setComfort] = useState('STANDARD');

  const {
    updatePathfindingID,
    updateRollingStockComfort,
    updateRollingStockComfortV2,
    updateRollingStockID,
  } = useOsrdConfActions();

  const selectRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    dispatch(updateRollingStockComfort(comfort as RollingStockComfortType));
    dispatch(updateRollingStockID(id));
    dispatch(updatePathfindingID(undefined));
    // TODO TS2 : when dropping v1, change comfort type to TrainScheduleBase['comfort']
    // and verify that i18n keys are properly set for air conditioning
    if (trainScheduleV2Activated)
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
