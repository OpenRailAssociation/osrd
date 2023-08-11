import React, { useEffect, useMemo, useState, useCallback, SetStateAction } from 'react';
import debounce from 'lodash/debounce';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { StandardAllowance, TrainSchedule } from 'common/api/osrdMiddlewareApi';
import { TYPES_UNITS, ALLOWANCE_UNITS_KEYS, AllowanceType } from './allowancesConsts';

interface StandardAllowanceDefaultProps {
  distributionsTypes?: { id: string; label: string }[];
  trainDetail?: TrainSchedule;
  changeType?: (type: unknown, typekey: string) => void;
  options?: {
    immediateMutation?: boolean;
    setDistribution?: boolean;
  };
  title?: string;
  t?: (key: string) => string;
  typeKey?: string;
  getBaseValue?: (typeKey: string) => {
    type: 'percentage' | 'time' | 'time_per_distance';
    value: number;
  };
  getAllowanceTypes?: (typeKey: string) => AllowanceType[];
  isCondensed?: boolean;
}

const StandardAllowanceDefault = (props: StandardAllowanceDefaultProps) => {
  const {
    distributionsTypes,
    trainDetail,
    t,
    options,
    title,
    changeType,
    typeKey,
    getBaseValue,
    getAllowanceTypes,
    isCondensed,
  } = props;

  const [value, setValue] = useState<{ type: keyof typeof TYPES_UNITS; value: number }>({
    type: 'time',
    value: 0,
  });
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([
    {
      id: 'percentage',
      label: t ? t('allowanceTypes.percentage') : '',
      unit: ALLOWANCE_UNITS_KEYS.percentage,
    },
  ]);

  let distributionType: { id: string; label: string } = { id: '', label: '' };
  if (distributionsTypes) [distributionType] = distributionsTypes;

  const [distribution, setDistribution] = useState<{ id: string; label: string } | undefined>(
    distributionType
  );

  const debouncedChangeType = useMemo(
    () =>
      debounce(
        (type) => {
          if (changeType) changeType(type, typeKey as string);
        },
        500,
        {
          leading: false,
          trailing: true,
        }
      ),
    [typeKey, changeType]
  );

  const handleType = useCallback(
    (newTypeValue: InputGroupSNCFValue) => {
      if (newTypeValue.type !== undefined) {
        const processedType = {
          type: newTypeValue.type,
          value:
            newTypeValue.value === '' || newTypeValue.value === undefined
              ? ''
              : +newTypeValue.value,
        };
        setValue(
          processedType as SetStateAction<{ type: keyof typeof TYPES_UNITS; value: number }>
        );
        debouncedChangeType(processedType);
      }
    },
    [debouncedChangeType]
  );

  const handleDistribution = (e: { target: { value: string } }) => {
    setDistribution(JSON.parse(e.target.value));
  };

  useEffect(() => {
    let thereIsStandard = false;

    trainDetail?.allowances?.forEach((allowance) => {
      if (allowance.allowance_type === 'standard' && allowance.ranges) {
        const currentDistribution = allowance.distribution;
        if (allowance.default_value?.value_type) {
          const findValue = (newAllowance: StandardAllowance): number | undefined => {
            if (newAllowance.default_value?.value_type === 'time') {
              return newAllowance.default_value.seconds;
            }
            if (newAllowance.default_value?.value_type === 'time_per_distance') {
              return newAllowance.default_value.minutes;
            }
            if (newAllowance.default_value?.value_type === 'percentage') {
              return newAllowance.default_value.percentage;
            }
            return undefined;
          };
          setValue({
            type: allowance.default_value.value_type,
            value: findValue(allowance) || 0,
          });
        }
        setDistribution(() => ({
          id: currentDistribution || '',
          label: t ? t(`distributions.${currentDistribution?.toLowerCase()}`) : '',
        }));
        thereIsStandard = true;
      }
    });
    if (!thereIsStandard) {
      setValue({
        type: 'time',
        value: 0,
      });
    }
  }, [trainDetail, t]);

  useEffect(() => {
    if (getBaseValue) setValue(getBaseValue(typeKey as string));
  }, [getBaseValue, typeKey]);

  useEffect(() => {
    if (getAllowanceTypes) setAllowanceTypes(getAllowanceTypes(typeKey as string));
  }, [getAllowanceTypes, typeKey]);

  useEffect(() => {
    if (allowanceTypes[0].label === 'time')
      allowanceTypes[0].label = t ? t('allowanceTypes.time') : '';
  }, [allowanceTypes, t]);

  return (
    <div className={`${options?.immediateMutation ? 'mareco' : 'row w-100 mareco'}`}>
      {!isCondensed && (
        <label
          htmlFor={`standardAllowanceType-${title}`}
          className={`${options?.immediateMutation ? 'text-normal' : 'col-md-2 text-normal'}`}
        >
          {title || (t && t('standardAllowancesWholePath'))}
        </label>
      )}

      <div className="col">
        <div className="row">
          {options?.setDistribution && (
            <>
              <div className="col-md-2 text-normal">{t ? t('perDefaultValue') : ''}</div>
              <div className="col-md-4">
                <SelectSNCF
                  id="distributionTypeSelector"
                  options={distributionsTypes as { id: string; label: string }[]}
                  labelKey="label"
                  onChange={handleDistribution}
                  sm
                  value={distribution || ''}
                />
              </div>
            </>
          )}
          {allowanceTypes.length > 1 ? (
            <InputGroupSNCF
              id="standardAllowanceTypeSelect"
              options={allowanceTypes}
              handleType={handleType}
              value={value.value}
              type={value.type}
              condensed={isCondensed}
              sm
            />
          ) : (
            <InputSNCF
              id={`standardAllowanceType-${title}`}
              onChange={(e) =>
                handleType({
                  type: allowanceTypes[0].id,
                  value: e.target.value,
                })
              }
              value={value.value}
              unit={allowanceTypes[0].unit}
              type="text"
              condensed={isCondensed}
              sm
              noMargin
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StandardAllowanceDefault;
