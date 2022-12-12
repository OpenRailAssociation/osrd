import React, { useEffect, useState } from 'react';
import { get, patch } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import { updateMustRedraw, updateSimulation } from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { FaTrash } from 'react-icons/fa';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import PropTypes from 'prop-types';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import { useTranslation } from 'react-i18next';
import { trainscheduleURI } from 'applications/osrd/components/Simulation/consts';
import { TYPES_UNITS } from './consts';

export default function StandardAllowanceDefault(props) {
  const {
    distributionsTypes,
    allowanceTypes,
    getAllowances,
    setIsUpdating,
    trainDetail,
    mutateSingleAllowance,
    selectedTrain,
    selectedProjection,
    t,
    dispatch,
    config,
    title
  } = props;

  /*
  const { selectedProjection, selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  */
  //const { t } = useTranslation(['allowances']);
  //const dispatch = useDispatch();
  const [value, setValue] = useState({
    type: 'time',
    value: 0,
  });
  const [distribution, setDistribution] = useState([]);

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
  }, [trainDetail]);

  console.log('allowanceTypes', allowanceTypes)

  return (
    <div className="row w-100 mareco">
      <div className="col-md-2 text-normal">{title || t('sandardAllowancesWholePath')}</div>

      <div className="col-md-6">

          {config.setDistribution && (
             <div className="row">
            <div className="col-md-1 text-normal">{t('Valeur par défault')}</div>
            <div className="col-md-3">
              <SelectSNCF
                id="distributionTypeSelector"
                options={distributionsTypes}
                labelKey="label"
                onChange={handleDistribution}
                sm
                value={distribution}
              />
            </div>
            </div>
             )
            }
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
      {
        !config.immediateMutation && (
          <div className="col">
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
        )
      }

    </div>
  );
}

StandardAllowanceDefault.propTypes = {
  // distributions: PropTypes.array.isRequired,
  distributionsTypes: PropTypes.array.isRequired,
  allowanceTypes: PropTypes.array.isRequired,
  getAllowances: PropTypes.func.isRequired,
  setIsUpdating: PropTypes.func.isRequired,
  trainDetail: PropTypes.object.isRequired,
  mutateSingleAllowance: PropTypes.func,
  config:PropTypes.object,
  title: PropTypes.string
};

StandardAllowanceDefault.defaultProps = {
  config:{
    immediateMutation: false,
    setDistribution: true
  }
}
