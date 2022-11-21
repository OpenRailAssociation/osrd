import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { comfort2pictogram } from './RollingStockHelpers';

export default function RollingStockCardButtons(props) {
  const { t } = useTranslation(['rollingstock']);
  const [comfort, setComfort] = useState('standard');

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

  const options = [
    { value: 'standard', label: t('comfortTypes.standard') },
    { value: 'heating', label: heatingLabel },
    { value: 'ac', label: acLabel },
  ];

  return (
    <div className="rollingstock-footer-buttons">
      <OptionsSNCF
        onChange={(e) => setComfort(e.target.value)}
        options={options}
        name="comfortChoice"
        selectedValue={comfort}
        sm
      />
      <button type="button" className="ml-2 btn btn-primary btn-sm">
        {t('selectRollingStock')}
      </button>
    </div>
  );
}

RollingStockCardButtons.propTypes = {};
