import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';

import { Allowance, RangeAllowance, EngineeringAllowance } from 'common/api/osrdMiddlewareApi';

import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getSelectedTrain } from 'reducers/osrdsimulation/selectors';
import OPModal from './OPModal';
import { AllowanceType, TYPES_UNITS } from './allowancesConsts';

function getAllowanceValue(values: RangeAllowance | EngineeringAllowance) {
  const { value } = values;
  if (value?.value_type === 'time_per_distance') {
    return value.minutes || 0;
  }
  if (value?.value_type === 'time') {
    return value.seconds || 0;
  }
  if (value?.value_type === 'percentage') {
    return value.percentage || 0;
  }
  return 0;
}

function getNewLine<T extends RangeAllowance>(
  allowanceType: string,
  defaultDistributionId: string | undefined,
  marecoBeginPosition: number,
  marecoEndPosition?: number
) {
  const selectedTrain = useSelector(getSelectedTrain);

  if (selectedTrain) {
    if (allowanceType === 'engineering') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return {
        allowance_type: 'engineering',
        distribution: defaultDistributionId,
        begin_position: 0,
        end_position: selectedTrain.base.stops[selectedTrain.base.stops.length - 1].position,
        value: {
          value_type: 'time',
          seconds: 0,
        },
      } as T;
    }
    return {
      begin_position: marecoBeginPosition ?? 0,
      end_position:
        marecoEndPosition ?? selectedTrain.base.stops[selectedTrain.base.stops.length - 1].position,
      value: {
        value_type: 'time',
        seconds: 0,
      },
    } as T;
  }
  return {} as T;
}

interface EmptyLineProps<T> {
  allowanceTypes: AllowanceType[];
  distributionsTypes: {
    id: string;
    label: string;
  }[];
  handleChange: (allowance: T) => void;
  allowanceType: Allowance['allowance_type'];
  marecoBeginPosition?: number;
  marecoEndPosition?: number;
  defaultDistributionId?: Allowance['distribution'];
}

function EmptyLine<T extends RangeAllowance>(props: EmptyLineProps<T>) {
  const {
    allowanceTypes,
    distributionsTypes,
    handleChange,
    allowanceType,
    marecoBeginPosition = 0,
    marecoEndPosition,
    defaultDistributionId,
  } = props;
  const { openModal } = useModal();

  const allowanceNewDatas = getNewLine<T>(
    allowanceType,
    defaultDistributionId,
    marecoBeginPosition,
    marecoEndPosition
  );
  const [values, setValues] = useState(allowanceNewDatas);
  const [fromTo, setFromTo] = useState('from');
  const { t } = useTranslation(['allowances']);

  const handleDistribution: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    setValues({
      ...values,
      distribution: JSON.parse(e.target.value).id,
    });
  };

  useEffect(() => {
    setValues({
      ...values,
      distribution: defaultDistributionId,
    });
  }, [defaultDistributionId]);

  const handleType = (type: InputGroupSNCFValue) => {
    if (type.type !== undefined) {
      setValues({
        ...values,
        value: {
          value_type: type.type,
          [TYPES_UNITS[type.type as keyof typeof TYPES_UNITS]]:
            type.value === '' || type.value === undefined ? '' : +type.value,
        },
      });
    }
  };

  return (
    <div className="row">
      <div className="col-lg-6 col-xl-3 d-flex align-items-center mb-lg-2">
        <span className="mr-1">{t('from')}</span>
        <InputSNCF
          id="input-allowances-begin_position"
          type="number"
          onChange={(e) => setValues({ ...values, begin_position: parseInt(e.target.value, 10) })}
          value={values.begin_position}
          placeholder={t('begin_position')}
          unit="m"
          isInvalid={Number(values.begin_position) >= Number(values.end_position)}
          noMargin
          sm
        />
        <button
          type="button"
          className="ml-1 btn-sm btn-primary text-uppercase"
          onClick={() => {
            setFromTo('begin_position');
            openModal(
              <ModalBodySNCF>
                <OPModal fromTo={fromTo} setValues={setValues} values={values} />
              </ModalBodySNCF>
            );
          }}
        >
          <small>{t('op')}</small>
        </button>
      </div>
      <div className="col-lg-6 col-xl-3 d-flex align-items-center mb-lg-2">
        <span className="mr-1">{t('to')}</span>
        <InputSNCF
          id="input-allowances-end_position"
          type="number"
          onChange={(e) => setValues({ ...values, end_position: parseInt(e.target.value, 10) })}
          value={values.end_position}
          placeholder={t('end_position')}
          unit="m"
          isInvalid={Number(values.begin_position) >= Number(values.end_position)}
          noMargin
          sm
        />
        <button
          type="button"
          className="ml-1 btn-sm btn-primary text-uppercase"
          onClick={() => {
            setFromTo('end_position');
            openModal(
              <ModalBodySNCF>
                <OPModal fromTo={fromTo} setValues={setValues} values={values} />
              </ModalBodySNCF>
            );
          }}
        >
          <small>{t('op')}</small>
        </button>
      </div>
      <div className="col-lg-4 col-xl-2">
        <SelectSNCF
          id="distributionTypeSelector"
          options={distributionsTypes}
          selectedValue={{
            id: defaultDistributionId,
            label: t(`distributions.${defaultDistributionId?.toLowerCase()}`),
          }}
          labelKey="label"
          onChange={handleDistribution}
          sm
        />
      </div>
      <div className="col-lg-6 col-xl-3">
        <InputGroupSNCF
          id="allowanceTypesSelect"
          options={allowanceTypes}
          handleType={handleType}
          value={getAllowanceValue(values)}
          sm
        />
      </div>
      <div className="col-lg-2 col-xl-1">
        <button
          type="button"
          onClick={() => handleChange(values)}
          className={classNames('btn btn-success btn-block btn-sm', {
            disabled:
              Number(values.begin_position) >= Number(values.end_position) ||
              !getAllowanceValue(values),
          })}
        >
          <i className="icons-add" />
        </button>
      </div>
    </div>
  );
}

export default EmptyLine;
