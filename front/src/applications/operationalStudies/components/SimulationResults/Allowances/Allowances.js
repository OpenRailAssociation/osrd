import PropTypes from 'prop-types';
import React, { useContext, useEffect, useState } from 'react';
import { updateAllowancesSettings } from 'reducers/osrdsimulation/actions';
import { useSelector } from 'react-redux';

import DotsLoader from 'common/DotsLoader/DotsLoader';
import { FaTrash } from 'react-icons/fa';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import OPModal from 'applications/operationalStudies/components/SimulationResults/Allowances/OPModal';
import SelectSNCF from 'common/BootstrapSNCF/SelectSNCF';
import StandardAllowanceDefault from 'applications/operationalStudies/components/SimulationResults/Allowances/StandardAllowanceDefault';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { TYPES_UNITS, ALLOWANCE_UNITS_KEYS } from './allowancesConsts';

function EmptyLine(props) {
  const {
    allowanceTypes,
    distributionsTypes,
    allowances,
    setAllowances,
    setUpdateAllowances,
    allowanceType,
    marecoBeginPosition,
    marecoEndPosition,
    defaultDistributionId,
  } = props;
  const { openModal } = useContext(ModalContext);

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
          isInvalid={values.begin_position >= values.end_position}
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
          isInvalid={values.begin_position >= values.end_position}
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
          value={
            values.value[TYPES_UNITS[values.value.value_type]] === ''
              ? ''
              : parseInt(values.value[TYPES_UNITS[values.value.value_type]], 10)
          }
          sm
        />
      </div>
      <div className="col-lg-2 col-xl-1">
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
  );
}

function Allowance(props) {
  const { data, delAllowance, idx, selectedTrain, simulation } = props;
  const { t } = useTranslation(['allowances']);

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
          {ALLOWANCE_UNITS_KEYS[data.value.value_type]}
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
  const {
    toggleAllowancesDisplay,
    t,
    dispatch,
    simulation,
    allowancesSettings,
    selectedProjection,
    selectedTrain,
    persistentAllowances,
    syncInProgress,
    mutateAllowances,
    getAllowances,
    trainDetail,
  } = props;

  const [allowances, setAllowances] = useState([]);
  const [rawExtensions] = useState([]);
  const [updateAllowances, setUpdateAllowances] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const allowanceTypes = [
    {
      id: 'time',
      label: t('allowanceTypes.time'),
      unit: ALLOWANCE_UNITS_KEYS.time,
    },
    {
      id: 'percentage',
      label: t('allowanceTypes.percentage'),
      unit: ALLOWANCE_UNITS_KEYS.percentage,
    },
    {
      id: 'time_per_distance',
      label: t('allowanceTypes.time_per_distance'),
      unit: ALLOWANCE_UNITS_KEYS.time_per_distance,
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

  const handleChangeAllowances = (newAllowances) => {
    mutateAllowances(newAllowances);
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
      handleChangeAllowances(allowances);
      setUpdateAllowances(false);
    }
  }, [allowances]);

  useEffect(() => {
    setAllowances(persistentAllowances);
  }, [persistentAllowances]);

  useEffect(() => {
    setIsUpdating(syncInProgress);
  }, [syncInProgress]);

  const standardAllowance =
    allowances &&
    allowances.find((allowance) => allowance.allowance_type === 'standard' && allowance.ranges);

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
      {allowances && (
        <>
          <div className="h2 d-flex">
            <StandardAllowanceDefault
              distributionsTypes={distributionsTypes}
              allowanceTypes={allowanceTypes}
              getAllowances={getAllowances}
              setIsUpdating={setIsUpdating}
              trainDetail={trainDetail}
              TYPES_UNITS={TYPES_UNITS}
              selectedTrain={selectedTrain}
              selectedProjection={selectedProjection}
              simulation={simulation}
              t={t}
              dispatch={dispatch}
            />
            <button
              type="button"
              className="ml-auto btn btn-primary btn-only-icon btn-sm"
              onClick={toggleAllowancesDisplay}
            >
              <i className="icons-arrow-up" />
            </button>
          </div>
          {allowances.find((a) => a.ranges) && (
            <div className="text-normal">{t('specificValuesOnIntervals')}</div>
          )}

          {allowances
            .find((a) => a.ranges)
            ?.ranges?.map((allowance, idx) => (
              <Allowance
                data={allowance}
                delAllowance={delAllowance}
                idx={idx}
                key={nextId()}
                selectedTrain={selectedTrain}
                simulation={simulation}
              />
            ))}

          {trainDetail.allowances.find((a) => a.ranges) && (
            <EmptyLine
              defaultDistributionId={defaultEngineeringDistributionId}
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
                <Allowance
                  data={allowance}
                  delAllowance={delAllowance}
                  idx={idx}
                  key={nextId()}
                  selectedTrain={selectedTrain}
                  simulation={simulation}
                />
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
          {rawExtensions.map(() => (
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

Allowance.propTypes = {
  data: PropTypes.object.isRequired,
  delAllowance: PropTypes.func.isRequired,
  idx: PropTypes.number.isRequired,
  t: PropTypes.func,
  dispatch: PropTypes.func,
  mutateAllowances: PropTypes.func,
  getAllowances: PropTypes.func,
};

EmptyLine.propTypes = {
  allowances: PropTypes.array,
  allowanceTypes: PropTypes.array.isRequired,
  allowanceType: PropTypes.string,
  distributionsTypes: PropTypes.array.isRequired,
  setAllowances: PropTypes.func.isRequired,
  setUpdateAllowances: PropTypes.func.isRequired,
  marecoBeginPosition: PropTypes.number,
  // eslint-disable-next-line react/require-default-props
  marecoEndPosition: PropTypes.number,
  defaultDistributionId: PropTypes.string.isRequired,
};
EmptyLine.defaultProps = {
  allowances: [],
  allowanceType: 'construction',
  marecoBeginPosition: 0,
};

Allowance.defaultProps = {
  t: (key) => key,
  dispatch: () => {},
  getAllowances: () => {},
  mutateAllowances: () => {},
};
