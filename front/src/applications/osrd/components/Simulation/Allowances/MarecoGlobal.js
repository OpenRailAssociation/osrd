import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import { get, patch } from 'common/requests';
import { FaTrash } from 'react-icons/fa';
import { useSelector, useDispatch } from 'react-redux';
import { setFailure, setSuccess } from 'reducers/main.ts';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation';

const trainscheduleURI = '/train_schedule/';

export default function MarecoGlobal(props) {
  const {
    allowanceTypes, getAllowances, setIsUpdating,
    trainDetail, TYPES_UNITS,
  } = props;
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const { t } = useTranslation(['allowances']);
  const dispatch = useDispatch();
  const [value, setValue] = useState({
    type: 'time',
    value: 0,
  });

  const handleType = (type) => {
    setValue({
      type: type.type,
      value: type.value === '' ? '' : parseInt(type.value, 10),
    });
  };

  const updateTrain = async () => {
    const newSimulationTrains = Array.from(simulation.trains);
    newSimulationTrains[selectedTrain] = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`);
    getAllowances();
    dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
    dispatch(updateMustRedraw(true));
  };

  const addMareco = async () => {
    const marecoConf = {
      allowance_type: 'mareco',
      default_value: {
        value_type: value.type,
        [TYPES_UNITS[value.type]]: value.value,
      },
    };
    const newAllowances = [];
    let ranges = [];
    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type === 'mareco') {
        ranges = allowance.ranges;
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
        title: t('allowanceModified.marecoAdd'),
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

  const delMareco = async () => {
    const newAllowances = [];
    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type !== 'mareco') {
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
        title: t('allowanceModified.marecoDel'),
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
    trainDetail.allowances.forEach((allowance) => {
      if (allowance.allowance_type === 'mareco') {
        setValue({
          type: allowance.default_value.value_type,
          value: allowance.default_value[TYPES_UNITS[allowance.default_value.value_type]],
        });
      }
    });
  }, [trainDetail]);

  return (
    <>
      <div className="row w-100 mareco">
        <div className="col-md-4 text-normal">
          {t('marecoWholePath')}
        </div>
        <div className="col-md-4">
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
            onClick={addMareco}
            className={`btn btn-success btn-sm mr-1 ${(
              value.value === 0 ? 'disabled' : null
            )}`}
          >
            {t('apply')}
          </button>
          <button
            type="button"
            onClick={() => delMareco(value)}
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

MarecoGlobal.propTypes = {
  TYPES_UNITS: PropTypes.object.isRequired,
  allowanceTypes: PropTypes.array.isRequired,
  getAllowances: PropTypes.func.isRequired,
  setIsUpdating: PropTypes.func.isRequired,
  trainDetail: PropTypes.object.isRequired,
};
