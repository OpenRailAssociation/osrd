import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { useDispatch } from 'react-redux';
import { updateRollingStockComfort, updateRollingStockID } from 'reducers/osrdconf';
import { comfort2pictogram } from './RollingStockHelpers';

export default function RollingStockCardButtons(props) {
  const { t } = useTranslation(['rollingstock']);
  const { id, nbCurves, setOpenedRollingStockCardId } = props;
  const [comfort, setComfort] = useState('standard');
  const dispatch = useDispatch();

  const acLabel = (
    <span>
      {comfort2pictogram('ac')} {t('comfortTypes.ac')}
    </span>
  );
  const heatingLabel = (
    <span>
      {comfort2pictogram('heating')} {t('comfortTypes.heating')}
    </span>
  );

  const selectRollingStock = () => {
    setOpenedRollingStockCardId(undefined);
    dispatch(updateRollingStockComfort(comfort));
    dispatch(updateRollingStockID(id));
  };

  const options = [
    { value: 'standard', label: t('comfortTypes.standard') },
    { value: 'heating', label: heatingLabel },
    { value: 'ac', label: acLabel },
  ];

  return (
    <div className="rollingstock-footer-buttons">
      {nbCurves > 1 ? (
        <OptionsSNCF
          onChange={(e) => setComfort(e.target.value)}
          options={options}
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
  nbCurves: PropTypes.number.isRequired,
  setOpenedRollingStockCardId: PropTypes.func.isRequired,
};
