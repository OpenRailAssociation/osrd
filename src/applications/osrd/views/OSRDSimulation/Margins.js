import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';

const marginDatas = {
  type: undefined,
  startPos: 0,
  endPos: 0,
  value: undefined,
};

/* Alors construction c'est juste un temps em s.
  ratio_time c'est un ratio donc un pourcentage.
  ratio_distance c'est en metre pour 10km
  Le begin_position et end_position c'est en metres
*/

const EmptyLine = (props) => {
  const { setValues, values } = props;
  const { t } = useTranslation(['margins']);

  const marginTypes = [
    {
      id: 'construction',
      label: t('marginTypes.construction'),
    },
    {
      id: 'ratio_time',
      label: t('marginTypes.ratio_time'),
    },
    {
      id: 'ratio_distance',
      label: t('marginTypes.ratio_distance'),
    },
  ];

  return (
    <div className="row">
      <div className="col-md-2">
        <InputSNCF
          type="number"
          onChange={(e) => setValues({ ...values, startPos: e.target.value })}
          value={values.startPos}
          placeholder={t('startPos')}
          sm
        />
      </div>
      <div className="col-md-2">
        <InputSNCF
          type="number"
          onChange={(e) => setValues({ ...values, endPos: e.target.value })}
          value={values.endPos}
          placeholder={t('endPos')}
          sm
        />
      </div>
      <div className="col-md-3">
        <InputGroupSNCF
          id="marginTypeSelect"
          options={marginTypes}
          onChange={(e) => console.log(e.target.value)}
          sm
        />
      </div>
    </div>
  );
};

export default function Margins() {
  const [values, setValues] = useState(marginDatas);
  return (
    <div className="osrd-simulation-container">
      <EmptyLine setValues={setValues} values={values} />
    </div>
  );
}

EmptyLine.propTypes = {
  setValues: PropTypes.func.isRequired,
  values: PropTypes.object.isRequired,
};
