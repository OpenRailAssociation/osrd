import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import OptionsSNCF, { Option } from 'common/BootstrapSNCF/OptionsSNCF';
import {
  updatePathfindingID,
  updatePowerRestrictionRanges,
  updateRollingStockComfort,
  updateRollingStockID,
} from 'reducers/osrdconf';
import { getRollingStockComfort } from 'reducers/osrdconf/selectors';
import { useOsrdConfContext } from 'common/osrdConfContext';
import { comfort2pictogram } from '../RollingStockSelector/RollingStockHelpers';

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
  const dispatch = useDispatch();
  const { t } = useTranslation(['rollingstock']);
  const { closeModal } = useContext(ModalContext);
  const {
    slice: { actions: osrdConfActions },
  } = useOsrdConfContext();
  const rollingStockComfort = useSelector(getRollingStockComfort);
  const [comfort, setComfort] = useState('STANDARD');

  const selectRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    dispatch(updateRollingStockComfort(comfort));
    dispatch(osrdConfActions.updateRollingStockID(id));
    dispatch(updateRollingStockID(id));
    dispatch(updatePowerRestrictionRanges([]));
    dispatch(updatePathfindingID(undefined));
    closeModal();
  };

  const comfortOptions = useMemo(() => {
    const options: Option[] = [{ value: 'STANDARD', label: t('comfortTypes.STANDARD') }];
    if (curvesComfortList.includes('HEATING')) {
      options.push({
        value: 'HEATING',
        label: (
          <span className="rollingstock-footer-button-with-picto">
            {comfort2pictogram('HEATING')} {t('comfortTypes.HEATING')}
          </span>
        ),
      });
    }
    if (curvesComfortList.includes('AC')) {
      options.push({
        value: 'AC',
        label: (
          <span className="rollingstock-footer-button-with-picto">
            {comfort2pictogram('AC')} {t('comfortTypes.AC')}
          </span>
        ),
      });
    }
    return options;
  }, [curvesComfortList]);

  useEffect(() => {
    setComfort(rollingStockComfort);
  }, [rollingStockComfort]);

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
