import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { get, patch } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main';
import {
  updateAllowancesSettings,
  updateMustRedraw,
  updateSimulation,
} from 'reducers/osrdsimulation';
import { useDispatch, useSelector } from 'react-redux';

import DotsLoader from 'common/DotsLoader/DotsLoader';
import { FaTrash } from 'react-icons/fa';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import OPModal from 'applications/osrd/components/Simulation/Allowances/OPModal';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import StandardAllowanceDefault from 'applications/osrd/components/Simulation/Allowances/StandardAllowanceDefault';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import { trainscheduleURI } from 'applications/osrd/components/Simulation/consts';

const TYPEUNITS = {
  time: 's',
  percentage: '%',
  time_per_distance: 'min/100km',
};

const TYPES_UNITS = {
  time: 'seconds',
  percentage: 'percentage',
  time_per_distance: 'minutes',
};

function EmptyLine(props) {
  const {
    allowanceTypes,
    distributionsTypes,
    allowances,
    setAllowances,
    setUpdateAllowances,
    allowanceType = 'construction',
    marecoBeginPosition,
    marecoEndPosition,
    defaultDistributionId,
  } = props;
  // console.log("Display EmptyLine", allowances)
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const allowanceNewDatas =
    allowanceType === 'engineering'
      ? {
          allowance_type: 'engineering',
          distribution: defaultDistributionId,
          begin_position: 0,
          end_position:
            simulation.trains[selectedTrain].base.stops[
              simulation.trains[selectedTrain].base.stops.length - 1
            ].position,
          value: {
            value_type: 'time',
            seconds: 0,
          },
        }
      : {
          allowance_type: 'standard',
          distribution: defaultDistributionId,
          begin_position: marecoBeginPosition ?? 0,
          end_position:
            marecoEndPosition ??
            simulation.trains[selectedTrain].base.stops[
              simulation.trains[selectedTrain].base.stops.length - 1
            ].position,
          value: {
            value_type: 'time',
            seconds: 0,
          },
        };
  const [values, setValues] = useState(allowanceNewDatas);
  const [fromTo, setFromTo] = useState('from');
  const { t } = useTranslation(['allowances']);

  const handleDistribution = (e) => {
    console.log('handleDistribution', JSON.parse(e.target.value));
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

  const handleType = (type) => {
    setValues({
      ...values,
      value: {
        value_type: type.type,
        [TYPES_UNITS[type.type]]: type.value === '' ? '' : parseInt(type.value, 10),
      },
    });
  };

  const addAllowance = (allowance) => {
    if (
      values.begin_position < values.end_position &&
      values.value[TYPES_UNITS[values.value.value_type]] > 0
    ) {
      const newAllowances = allowances !== null ? Array.from(allowances) : [];

      // If Mareco Amend the Mareco List, if not Mareco ist add one
      if (allowance.allowance_type === 'standard') {
        newAllowances.find((d) => d.ranges)?.ranges.push(allowance);
      } else {
        // If constuction just add
        newAllowances.push(allowance);
      }

      setAllowances(newAllowances); // This is to be resolved
      setUpdateAllowances(true);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-md-3 d-flex align-items-center">
          <span className="mr-1">{t('from')}</span>
          <InputSNCF
            id="input-allowances-begin_position"
            type="number"
            onChange={(e) => setValues({ ...values, begin_position: parseInt(e.target.value, 10) })}
            value={values.begin_position}
            placeholder={t('begin_position')}
            unit="m"
            isInvalid={values.begin_position >= values.end_position}
            noMargin
            sm
          />
          <button
            type="button"
            className="ml-1 btn-sm btn-primary text-uppercase"
            data-toggle="modal"
            data-target={`#op-input-modal-${allowanceType}`}
            onClick={() => setFromTo('begin_position')}
          >
            <small>{t('op')}</small>
          </button>
        </div>
        <div className="col-md-3 d-flex align-items-center">
          <span className="mr-1">{t('to')}</span>
          <InputSNCF
            id="input-allowances-end_position"
            type="number"
            onChange={(e) => setValues({ ...values, end_position: parseInt(e.target.value, 10) })}
            value={values.end_position}
            placeholder={t('end_position')}
            unit="m"
            isInvalid={values.begin_position >= values.end_position}
            noMargin
            sm
          />
          <button
            type="button"
            className="ml-1 btn-sm btn-primary text-uppercase"
            data-toggle="modal"
            data-target={`#op-input-modal-${allowanceType}`}
            onClick={() => setFromTo('end_position')}
          >
            <small>{t('op')}</small>
          </button>
        </div>
        <div className="col-md-2">
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
        <div className="col-md-3">
          <InputGroupSNCF
            id="allowanceTypesSelect"
            options={allowanceTypes}
            handleType={handleType}
            value={
              values.value[TYPES_UNITS[values.value.value_type]] === ''
                ? ''
                : parseInt(values.value[TYPES_UNITS[values.value.value_type]], 10)
            }
            sm
          />
        </div>
        <div className="col-md-1">
          <button
            type="button"
            onClick={() => addAllowance(values)}
            className={`btn btn-success btn-block btn-sm ${
              values.begin_position >= values.end_position || values.value === 0 ? 'disabled' : null
            }`}
          >
            <i className="icons-add" />
          </button>
        </div>
      </div>
      <ModalSNCF htmlID={`op-input-modal-${allowanceType}`}>
        <ModalBodySNCF>
          <OPModal fromTo={fromTo} setValues={setValues} values={values} />
        </ModalBodySNCF>
      </ModalSNCF>
    </>
  );
}

function Allowance(props) {
  const { data, delAllowance, idx } = props;
  const { t } = useTranslation(['allowances']);
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);

  const position2name = (position) => {
    const place = simulation.trains[selectedTrain].base.stops.find(
      (element) => element.position === position
    );
    return place && place.name !== null
      ? `${place.name} (${Math.round(position)}m)`
      : `${position}m`;
  };

  return (
    <div className="allowance-line">
      <div className="row align-items-center">
        <div className="col-md-1">
          <small>{idx + 1}</small>
        </div>
        <div className="col-md-2 text-left">{position2name(data.begin_position)}</div>
        <div className="col-md-3 text-center">{position2name(data.end_position)}</div>
        <div className="col-md-2 text-left">
          {t(`distributions.${data.distribution?.toLowerCase()}`)}
        </div>
        <div className="col-md-3 text-left">
          {t(`allowanceTypes.${data.value.value_type}`)} /
          {data.value[TYPES_UNITS[data.value.value_type]]}
          {TYPEUNITS[data.value.value_type]}
        </div>
        <div className="col-md-1 d-flex align-items-right">
          <button
            type="button"
            className="btn btn-sm btn-only-icon btn-white text-danger"
            onClick={() => delAllowance(idx, data.allowance_type)}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Allowances(props) {
  const { toggleAllowancesDisplay } = props;
  const { allowancesSettings, selectedProjection, selectedTrain } = useSelector(
    (state) => state.osrdsimulation
  );
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const [trainDetail, setTrainDetail] = useState(undefined);
  const [allowances, setAllowances] = useState([]);
  const [rawExtensions, setRawExtensions] = useState([]);
  const [updateAllowances, setUpdateAllowances] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dispatch = useDispatch();
  const { t } = useTranslation(['allowances']);

  const allowanceTypes = [
    {
      id: 'time',
      label: t('allowanceTypes.time'),
      unit: TYPEUNITS.time,
    },
    {
      id: 'percentage',
      label: t('allowanceTypes.percentage'),
      unit: TYPEUNITS.percentage,
    },
    {
      id: 'time_per_distance',
      label: t('allowanceTypes.time_per_distance'),
      unit: TYPEUNITS.time_per_distance,
    },
  ];

  // Do not change the keys (id, label) without checking implications
  const distributionsTypes = [
    {
      id: 'LINEAR',
      label: t('distributions.linear'),
    },
    {
      id: 'MARECO',
      label: t('distributions.mareco'),
    },
  ];

  const getAllowances = async () => {
    try {
      setIsUpdating(true);
      const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
      setTrainDetail(result);
      setAllowances(result.allowances);
      setIsUpdating(false);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(
        setFailure({
          name: e.name,
          message: e.message,
        })
      );
    }
  };

  // Change this to adapt to MARECO SPEC
  const changeAllowances = async (newAllowances) => {
    try {
      setIsUpdating(true);
      await patch(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`, {
        ...trainDetail,
        allowances: newAllowances,
      });
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
      dispatch(
        setSuccess({
          title: t('allowanceModified.anyAllowanceModified'),
          text: '',
        })
      );
      setIsUpdating(false);
    } catch (e) {
      setIsUpdating(false);
      console.log('ERROR', e);
      dispatch(
        setFailure({
          name: e.name,
          message: t('allowanceModified.anyAllowanceModificationError'),
        })
      );
    }
  };

  const delAllowance = (idx, allowanceType) => {
    // change to take into considerations Mareco Ones
    const newAllowances = Array.from(allowances);
    // First check if i is a construction allowance
    if (allowanceType === 'engineering') {
      newAllowances.splice(idx, 1);
    } else {
      newAllowances.find((a) => a.allowance_type === 'standard')?.ranges.splice(idx, 1);
    }

    if (newAllowances.length === 0) {
      const newAllowancesSettings = { ...allowancesSettings };
      dispatch(
        updateAllowancesSettings({
          ...newAllowancesSettings,
          [simulation.trains[selectedTrain].id]: {
            ...newAllowancesSettings[simulation.trains[selectedTrain].id],
            ecoBlocks: false,
            baseBlocks: true,
          },
        })
      );
    }
    setAllowances(newAllowances);
    setUpdateAllowances(true);
  };

  useEffect(() => {
    if (updateAllowances) {
      changeAllowances(allowances);
      setUpdateAllowances(false);
    }
  }, [allowances]);

  useEffect(() => {
    getAllowances();
  }, [selectedTrain]);

  const handleExtensionsChange = (extensions) => {
    const newMarecoProposal = extensions
      .filter((d) => d.extensionData !== 'mareco')
      .map((d) => ({
        begin_position: d.currentSelection[0],
        end_position: d.currentSelection[1],
      }));
    setRawExtensions(newMarecoProposal);
  };

  const standardAllowance = allowances.find(
    (allowance) => allowance.allowance_type === 'standard' && allowance.ranges
  );

  // Engineergin can be defined alone, yet its default distribution depends on eventuel defined standard margin

  const defaultEngineeringDistributionId =
    standardAllowance?.distribution || distributionsTypes[0]?.id;

  return (
    <div className="osrd-simulation-container">
      {isUpdating && (
        <div className="allowances-updating-loader">
          <DotsLoader />
        </div>
      )}
      {trainDetail && trainDetail.allowances && (
        <>
          <div className="h2 d-flex">
            <StandardAllowanceDefault
              distributionsTypes={distributionsTypes}
              allowanceTypes={allowanceTypes}
              getAllowances={getAllowances}
              setIsUpdating={setIsUpdating}
              trainDetail={trainDetail}
              TYPES_UNITS={TYPES_UNITS}
            />
            <button
              type="button"
              className="ml-auto btn btn-primary btn-only-icon btn-sm"
              onClick={toggleAllowancesDisplay}
            >
              <i className="icons-arrow-up" />
            </button>
          </div>
          {trainDetail.allowances.find((a) => a.ranges) && (
            <div className="text-normal">{t('specificValuesOnIntervals')}</div>
          )}

          {trainDetail.allowances
            .find((a) => a.ranges)
            ?.ranges?.map((allowance, idx) => (
              <Allowance data={allowance} delAllowance={delAllowance} idx={idx} key={nextId()} />
            ))}

          {trainDetail.allowances.find((a) => a.ranges) && (
            <EmptyLine
              defaultDistributionId={standardAllowance?.distribution}
              setAllowances={setAllowances}
              distributionsTypes={distributionsTypes}
              setUpdateAllowances={setUpdateAllowances}
              allowances={allowances}
              distribution="mareco"
              allowanceTypes={allowanceTypes}
            />
          )}

          <br />
          <div className="h2 text-normal">{t('engineeringAllowances')}</div>
          <div className="row my-1 small">
            <div className="col-md-3 text-lowercase" />
            <div className="col-md-3" />
            <div className="col-md-2">{t('allowanceType')}</div>
            <div className="col-md-3">{t('units')}</div>
            <div className="col-md-1" />
          </div>
          {trainDetail.allowances.map((allowance, idx) => {
            if (allowance.allowance_type === 'engineering') {
              return (
                <Allowance data={allowance} delAllowance={delAllowance} idx={idx} key={nextId()} />
              );
            }
            return null;
          })}
          <EmptyLine
            defaultDistributionId={defaultEngineeringDistributionId}
            setAllowances={setAllowances}
            distributionsTypes={distributionsTypes}
            setUpdateAllowances={setUpdateAllowances}
            allowances={allowances}
            allowanceType="engineering"
            allowanceTypes={allowanceTypes}
          />
          {rawExtensions.map((rawExtension) => (
            <EmptyLine
              defaultDistributionId={defaultEngineeringDistributionId}
              setAllowances={setAllowances}
              distributionsTypes={distributionsTypes}
              setUpdateAllowances={setUpdateAllowances}
              allowances={allowances}
              allowanceTypes={allowanceTypes}
              allowanceType="engineering"
              key={nextId()}
            />
          ))}
        </>
      )}
    </div>
  );
}

Allowances.propTypes = {
  toggleAllowancesDisplay: PropTypes.func.isRequired,
};

Allowance.propTypes = {
  data: PropTypes.object.isRequired,
  delAllowance: PropTypes.func.isRequired,
  idx: PropTypes.number.isRequired,
};

EmptyLine.propTypes = {
  allowances: PropTypes.array,
  allowanceTypes: PropTypes.array.isRequired,
  distributionsTypes: PropTypes.array.isRequired,
  setAllowances: PropTypes.func.isRequired,
  setUpdateAllowances: PropTypes.func.isRequired,
};
EmptyLine.defaultProps = {
  allowances: [],
};
