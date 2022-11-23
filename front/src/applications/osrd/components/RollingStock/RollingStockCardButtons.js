import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { useDispatch } from 'react-redux';
import { updateRollingStockComfort, updateRollingStockID } from 'reducers/osrdconf';
import { comfort2pictogram } from './RollingStockHelpers';

export default function RollingStockCardButtons(props) {
  const { t } = useTranslation(['rollingstock']);
  const { id, curvesComfortList, setOpenedRollingStockCardId } = props;
  const [comfort, setComfort] = useState('standard');
  const dispatch = useDispatch();

  const acLabel = (
    <span className="rollingstock-footer-button-with-picto">
      {comfort2pictogram('ac')} {t('comfortTypes.ac')}
    </span>
  );
  const heatingLabel = (
    <span className="rollingstock-footer-button-with-picto">
      {comfort2pictogram('heating')} {t('comfortTypes.heating')}
    </span>
  );

  const selectRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    dispatch(updateRollingStockComfort(comfort));
    dispatch(updateRollingStockID(id));
  };

  const setOptions = () => {
    const options = [{ value: 'standard', label: t('comfortTypes.standard') }];
    if (curvesComfortList.includes('heating')) {
      options.push({ value: 'heating', label: heatingLabel });
    }
    if (curvesComfortList.includes('ac')) {
      options.push({ value: 'ac', label: acLabel });
    }
    return options;
  };

  return (
    <div className="rollingstock-footer-buttons">
      {curvesComfortList.length > 1 ? (
        <OptionsSNCF
          onChange={(e) => setComfort(e.target.value)}
          options={setOptions()}
          name="comfortChoice"
          selectedValue={comfort}
          sm
        />
      ) : null}
      <button
        type="button"
        className="ml-2 btn btn-primary btn-sm"
        onClick={selectRollingStock}
        data-dismiss="modal"
      >
        {t('selectRollingStock')}
      </button>
    </div>
  );
}

RollingStockCardButtons.propTypes = {
  id: PropTypes.number.isRequired,
  curvesComfortList: PropTypes.array.isRequired,
  setOpenedRollingStockCardId: PropTypes.func.isRequired,
};
