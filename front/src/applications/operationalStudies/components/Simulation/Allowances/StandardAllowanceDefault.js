import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { get, patch } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';

import { FaTrash } from 'react-icons/fa';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import PropTypes from 'prop-types';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { trainscheduleURI } from 'applications/operationalStudies/components/Simulation/consts';
import debounce from 'lodash/debounce';
import { TYPES_UNITS } from './consts';

import { ALLOWANCE_UNITS_KEYS } from './consts';

export default function StandardAllowanceDefault(props) {
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
  } = props;

  const [value, setValue] = useState({
    type: 'time',
    value: 0,
  });
  const [allowanceTypes, setAllowanceTypes] = useState([
    {
      id: 'percentage',
      label: t('allowanceTypes.percentage'),
      unit: ALLOWANCE_UNITS_KEYS.percentage,
    },
  ]);
  const [distribution, setDistribution] = useState(distributionsTypes[0]);

  const debouncedChangeType = useMemo(
    () =>
      debounce(
        (type) => {
          changeType(type, typeKey);
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
    (newTypeValue) => {
      const processedType = {
        type: newTypeValue.type,
        value: newTypeValue.value === '' ? '' : parseInt(newTypeValue.value, 10),
      };
      setValue(processedType);
      debouncedChangeType(processedType);
    },
    [debouncedChangeType]
  );

  const handleDistribution = (e) => {
    setDistribution(JSON.parse(e.target.value));
  };

  // To be moved to HOC, use mutateSigleAllowance
  const updateTrain = async () => {
    const newSimulationTrains = Array.from(simulation.trains);
    newSimulationTrains[selectedTrain] = await get(
      `${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`,
      {
        id: simulation.trains[selectedTrain].id,
        path: selectedProjection.path,
      }
    );
    getAllowances();
    dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
    dispatch(updateMustRedraw(true));
  };

  // In fact it is Create/Update  // To be moved to HOC, use mutateSigleAllowance
  const addStandard = async () => {
    const marecoConf = {
      allowance_type: 'standard',
      distribution: distribution.id,
      default_value: {
        value_type: value.type,
        [TYPES_UNITS[value.type]]: value.value,
      },
    };
    const newAllowances = [];
    let ranges = [];
    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type === 'standard' && allowance.ranges) {
        ranges = allowance.ranges; // Preserve existing Ranges
      } else {
        newAllowances.push(allowance);
      }
    });
    newAllowances.push({ ...marecoConf, ranges });

    try {
      setIsUpdating(true);
      await patch(`${trainscheduleURI}${trainDetail.id}/`, {
        ...trainDetail,
        allowances: newAllowances,
      });
      dispatch(
        setSuccess({
          title: t('allowanceModified.standardAllowanceAdd'),
          text: '',
        })
      );
      updateTrain();
    } catch (e) {
      console.log('ERROR', e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
    setIsUpdating(false);
  };

  // To be moved to HOC
  const delStandard = async () => {
    const newAllowances = [];
    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type !== 'standard') {
        newAllowances.push(allowance);
      }
    });
    try {
      setIsUpdating(true);
      await patch(`${trainscheduleURI}${trainDetail.id}/`, {
        ...trainDetail,
        allowances: newAllowances,
      });
      setValue({
        type: 'time',
        value: 0,
      });
      dispatch(
        setSuccess({
          title: t('allowanceModified.standardAllowanceDel'),
          text: '',
        })
      );
      updateTrain();
    } catch (e) {
      console.log('ERROR', e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
    setIsUpdating(false);
  };

  useEffect(() => {
    let thereIsStandard = false;

    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type === 'standard' && allowance.ranges) {
        const currentDistribution = allowance.distribution;
        setValue({
          type: allowance.default_value.value_type,
          value: allowance.default_value[TYPES_UNITS[allowance.default_value.value_type]],
        });
        setDistribution(() => ({
          id: currentDistribution,
          label: t(`distributions.${currentDistribution.toLowerCase()}`),
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
    if (getBaseValue) setValue(getBaseValue(typeKey));
  }, [getBaseValue, typeKey]);

  useEffect(() => {
    if (getAllowanceTypes) setAllowanceTypes(getAllowanceTypes(typeKey));
  }, [getAllowanceTypes, typeKey]);

  return (
    <div className={`${options.immediateMutation ? 'mareco' : 'row w-100 mareco'}`}>
      <div className={`${options.immediateMutation ? 'text-normal' : 'col-md-2 text-normal'}`}>
        {title || t('sandardAllowancesWholePath')}
      </div>

      <div className="col">
        <div className="row">
          {options.setDistribution && (
            <>
              <div className="col-md-2 text-normal">{t('perDefaultValue')}</div>
              <div className="col-md-4">
                <SelectSNCF
                  id="distributionTypeSelector"
                  options={distributionsTypes}
                  labelKey="label"
                  onChange={handleDistribution}
                  sm
                  value={distribution || ''}
                />
              </div>
            </>
          )}
          <div className="col">
            <InputGroupSNCF
              id="standardAllowanceTypeSelect"
              options={allowanceTypes}
              handleType={handleType}
              value={value.value}
              type={value.type}
              sm
            />
          </div>
        </div>
      </div>
      {!options.immediateMutation && (
        <div className="col-md-3">
          <button
            type="button"
            onClick={mutateSingleAllowance || addStandard}
            className={`btn btn-success btn-sm mr-1 ${value.value === 0 ? 'disabled' : null}`}
          >
            {t('apply')}
          </button>
          <button
            type="button"
            onClick={() => delStandard(value)}
            className={`btn btn-danger btn-sm ${value.value === 0 ? 'disabled' : null}`}
          >
            <FaTrash />
          </button>
        </div>
      )}
    </div>
  );
}

StandardAllowanceDefault.propTypes = {
  // distributions: PropTypes.array.isRequired,
  distributionsTypes: PropTypes.array.isRequired,
  getAllowanceTypes: PropTypes.func.isRequired,
  setIsUpdating: PropTypes.func.isRequired,
  trainDetail: PropTypes.object.isRequired,
  selectedTrain: PropTypes.number,
  mutateSingleAllowance: PropTypes.func,
  changeType: PropTypes.func,
  options: PropTypes.object,
  title: PropTypes.string,
};

StandardAllowanceDefault.defaultProps = {
  options: {
    immediateMutation: false,
    setDistribution: true,
  },
  changeType: () => {
    console.log('default changeType');
  },
  mutateSingleAllowance: undefined,
  title: '',
  selectedTrain: 0,
};
