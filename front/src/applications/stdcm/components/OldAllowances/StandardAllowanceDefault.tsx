import React, { useEffect, useMemo, useState, useCallback, SetStateAction } from 'react';
import debounce from 'lodash/debounce';
import { FaTrash } from 'react-icons/fa';
import { get, patch } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { trainscheduleURI } from 'applications/operationalStudies/components/SimulationResults/simulationResultsConsts';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import {
  Allowance,
  RangeAllowance,
  StandardAllowance,
  TrainSchedule,
} from 'common/api/osrdMiddlewareApi';
import { SimulationSnapshot } from 'reducers/osrdsimulation/types';
import { Dispatch } from 'redux';
import { AxiosError } from 'axios';
import { TYPES_UNITS, ALLOWANCE_UNITS_KEYS, AllowanceType } from './allowancesConsts';

interface StandardAllowanceDefaultProps {
  distributionsTypes?: { id: string; label: string }[];
  getAllowances?: () => void;
  setIsUpdating?: (isUpdating: boolean) => void;
  trainDetail?: TrainSchedule;
  selectedTrain?: number;
  mutateSingleAllowance?: () => void;
  changeType?: (type: unknown, typekey: string) => void;
  options?: {
    immediateMutation?: boolean;
    setDistribution?: boolean;
  };
  title?: string;
  selectedProjection?: {
    id: unknown;
    path: unknown;
  };
  simulation?: SimulationSnapshot;
  t?: (key: string) => string;
  dispatch?: Dispatch;
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
    getAllowances,
    setIsUpdating,
    trainDetail,
    mutateSingleAllowance,
    selectedTrain,
    selectedProjection,
    simulation,
    t,
    dispatch,
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

  // To be moved to HOC, use mutateSigleAllowance
  const updateTrain = async () => {
    if (simulation && selectedTrain) {
      const newSimulationTrains = Array.from(simulation.trains);
      newSimulationTrains[selectedTrain] = await get(
        `${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`,
        {
          params: {
            id: simulation.trains[selectedTrain].id,
            path: selectedProjection?.path,
          },
        }
      );
      if (getAllowances) getAllowances();
      if (dispatch) {
        dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
        dispatch(updateMustRedraw(true));
      }
    }
  };

  // In fact it is Create/Update  // To be moved to HOC, use mutateSigleAllowance
  const addStandard = async () => {
    const marecoConf = {
      allowance_type: 'standard',
      distribution: distribution?.id,
      default_value: {
        value_type: value?.type,
        [TYPES_UNITS[value?.type]]: value?.value,
      },
    };
    const newAllowances = [];
    let ranges: RangeAllowance[] = [];
    trainDetail?.allowances?.forEach((allowance) => {
      if (allowance.allowance_type === 'standard' && allowance.ranges) {
        ranges = allowance.ranges; // Preserve existing Ranges
      } else {
        newAllowances.push(allowance);
      }
    });
    newAllowances.push({ ...marecoConf, ranges });

    try {
      if (setIsUpdating) setIsUpdating(true);
      await patch(`${trainscheduleURI}${trainDetail?.id}/`, {
        ...trainDetail,
        allowances: newAllowances,
      });
      if (dispatch)
        dispatch(
          setSuccess({
            title: t ? t('allowanceModified.standardAllowanceAdd') : '',
            text: '',
          })
        );
      updateTrain();
    } catch (e: unknown) {
      const err = e as AxiosError;
      if (dispatch)
        dispatch(
          setFailure({
            name: err.name,
            message: err.message,
          })
        );
    }
    if (setIsUpdating) setIsUpdating(false);
  };

  // To be moved to HOC
  const delStandard = async () => {
    const newAllowances: Allowance[] = [];
    trainDetail?.allowances?.forEach((allowance) => {
      if (allowance.allowance_type !== 'standard') {
        newAllowances.push(allowance);
      }
    });
    try {
      if (setIsUpdating) setIsUpdating(true);
      await patch(`${trainscheduleURI}${trainDetail?.id}/`, {
        ...trainDetail,
        allowances: newAllowances,
      });
      setValue({
        type: 'time',
        value: 0,
      });
      if (dispatch)
        dispatch(
          setSuccess({
            title: t ? t('allowanceModified.standardAllowanceDel') : '',
            text: '',
          })
        );
      updateTrain();
    } catch (e: unknown) {
      const err = e as AxiosError;
      if (dispatch)
        dispatch(
          setFailure({
            name: err.name,
            message: err.message,
          })
        );
    }
    if (setIsUpdating) setIsUpdating(false);
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
          {title || (t && t('sandardAllowancesWholePath'))}
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
      {!options?.immediateMutation && (
        <div className="col-md-3">
          <button
            type="button"
            onClick={mutateSingleAllowance || addStandard}
            className={`btn btn-success btn-sm mr-1 ${
              (value?.value as unknown as number) === 0 ||
              (value?.value as unknown as string) === ''
                ? 'disabled'
                : null
            }`}
          >
            {t ? t('apply') : ''}
          </button>
          <button
            type="button"
            onClick={() => delStandard()}
            className={`btn btn-danger btn-sm ${
              (value?.value as unknown as number) === 0 ||
              (value?.value as unknown as string) === ''
                ? 'disabled'
                : null
            }`}
          >
            <FaTrash />
          </button>
        </div>
      )}
    </div>
  );
};

export default StandardAllowanceDefault;
