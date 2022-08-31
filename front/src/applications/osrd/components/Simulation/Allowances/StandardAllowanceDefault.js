import React, { useEffect, useState } from 'react';
import { get, patch } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main.ts';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import { FaTrash } from 'react-icons/fa';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import PropTypes from 'prop-types';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { useTranslation } from 'react-i18next';

const trainscheduleURI = '/train_schedule/';

export default function StandardAllowanceDefault(props) {
  const {
    distributionsTypes, allowanceTypes, getAllowances, setIsUpdating,
    trainDetail, TYPES_UNITS,
  } = props;
  const {
    selectedProjection, selectedTrain,
  } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const { t } = useTranslation(['allowances']);
  const dispatch = useDispatch();
  const [value, setValue] = useState({
    type: 'time',
    value: 0,
  });
  const [distribution, setDistribution] = useState(distributionsTypes[0]);

  const handleType = (type) => {
    setValue({
      type: type.type,
      value: type.value === '' ? '' : parseInt(type.value, 10),
    });
  };

  const handleDistribution = (e) => {
    setDistribution(JSON.parse(e.target.value));
  };

  const updateTrain = async () => {
    const newSimulationTrains = Array.from(simulation.trains);
    newSimulationTrains[selectedTrain] = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`,
      {
        id: simulation.trains[selectedTrain].id,
        path: selectedProjection.path,
      });
    getAllowances();
    dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
    dispatch(updateMustRedraw(true));
  };

  // In fact it is Create/Update
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
      dispatch(setSuccess({
        title: t('allowanceModified.standardAllowanceAdd'),
        text: '',
      }));
      updateTrain();
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
    setIsUpdating(false);
  };

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
      dispatch(setSuccess({
        title: t('allowanceModified.standardAllowanceDel'),
        text: '',
      }));
      updateTrain();
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
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
        setDistribution((distribution) => ({
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
  }, [trainDetail]);

  return (
    <>
      <div className="row w-100 mareco">
        <div className="col-md-2 text-normal">
          {t('sandardAllowancesWholePath')}
        </div>
        <div className="col-md-1 text-normal">
          {t('Valeur par défault')}
        </div>
        <div className="col-md-3">
          <SelectSNCF
            id="distributionTypeSelector"
            options={distributionsTypes}
            selectedValue={distribution}
            labelKey="label"
            onChange={handleDistribution}
            sm
          />
        </div>
        <div className="col-md-3">
          <InputGroupSNCF
            id="allowanceTypeSelect"
            options={allowanceTypes}
            handleType={handleType}
            value={value.value}
            sm
          />
        </div>
        <div className="col-md-3">
          <button
            type="button"
            onClick={addStandard}
            className={`btn btn-success btn-sm mr-1 ${(
              value.value === 0 ? 'disabled' : null
            )}`}
          >
            {t('apply')}
          </button>
          <button
            type="button"
            onClick={() => delStandard(value)}
            className={`btn btn-danger btn-sm ${(
              value.value === 0 ? 'disabled' : null
            )}`}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </>
  );
}

StandardAllowanceDefault.propTypes = {
  TYPES_UNITS: PropTypes.object.isRequired,
  // distributions: PropTypes.array.isRequired,
  distributionsTypes: PropTypes.array.isRequired,
  allowanceTypes: PropTypes.array.isRequired,
  getAllowances: PropTypes.func.isRequired,
  setIsUpdating: PropTypes.func.isRequired,
  trainDetail: PropTypes.object.isRequired,
};
