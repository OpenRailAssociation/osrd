import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import ModalSNCF from 'common/BootstrapSNCF/ModalSNCF/ModalSNCF';
import ModalBodySNCF from 'common/BootstrapSNCF/ModalSNCF/ModalBodySNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import OPModal from 'applications/osrd/components/Simulation/Margins/OPModal';
import { useSelector, useDispatch } from 'react-redux';
import { get, put } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main.ts';
import { updateSimulation, updateMustRedraw } from 'reducers/osrdsimulation';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';
import DotsLoader from 'common/DotsLoader/DotsLoader';

const trainscheduleURI = '/train_schedule/';

const marginNewDatas = {
  type: 'construction',
  begin_position: 0,
  end_position: 0,
  value: 0,
};

const TYPEUNITS = {
  construction: 's',
  ratio_time: '%',
  ratio_distance: 'min/100km',
};

const EmptyLine = (props) => {
  const { margins, setMargins, setUpdateMargins } = props;
  const [values, setValues] = useState(marginNewDatas);
  const [fromTo, setFromTo] = useState('from');
  const { t } = useTranslation(['margins']);

  const marginTypes = [
    {
      id: 'construction',
      label: 'Construction', // t('marginTypes.construction'),
      unit: TYPEUNITS.construction,
    },
    {
      id: 'ratio_time',
      label: t('marginTypes.ratio_time'),
      unit: TYPEUNITS.ratio_time,
    },
    {
      id: 'ratio_distance',
      label: t('marginTypes.ratio_distance'),
      unit: TYPEUNITS.ratio_distance,
    },
  ];

  const handleType = (type) => {
    setValues({
      ...values,
      type: type.type,
      value: type.value === '' ? '' : parseInt(type.value, 10),
    });
  };

  const addMargins = (margin) => {
    if (values.begin_position < values.end_position && values.value > 0) {
      const newMargins = (margins !== null) ? Array.from(margins) : [];
      newMargins.push(margin);
      setMargins(newMargins);
      setUpdateMargins(true);
    }
  };

  return (
    <>
      <div className="row">
        <div className="col-md-3 d-flex align-items-center">
          <span className="mr-1">{t('from')}</span>
          <InputSNCF
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
            data-target="#op-input-modal"
            onClick={() => setFromTo('begin_position')}
          >
            <small>{t('op')}</small>
          </button>
        </div>
        <div className="col-md-3 d-flex align-items-center">
          <span className="mr-1">{t('to')}</span>
          <InputSNCF
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
            data-target="#op-input-modal"
            onClick={() => setFromTo('end_position')}
          >
            <small>{t('op')}</small>
          </button>
        </div>
        <div className="col-md-4">
          <InputGroupSNCF
            id="marginTypeSelect"
            options={marginTypes}
            handleType={handleType}
            value={values.value === '' ? '' : parseInt(values.value, 10)}
            sm
          />
        </div>
        <div className="col-md-2">
          <button
            type="button"
            onClick={() => addMargins(values)}
            className={`btn btn-success btn-sm ${(
              values.begin_position >= values.end_position
              || values.value === 0 ? 'disabled' : null
            )}`}
          >
            <i className="icons-add" />
          </button>
        </div>
      </div>
      <ModalSNCF htmlID="op-input-modal">
        <ModalBodySNCF>
          <OPModal
            fromTo={fromTo}
            setValues={setValues}
            values={values}
          />
        </ModalBodySNCF>
      </ModalSNCF>
    </>
  );
};

const Margin = (props) => {
  const { data, delMargin, idx } = props;
  const { t } = useTranslation(['margins']);
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);

  const position2name = (position) => {
    const place = simulation.trains[selectedTrain].base.stops.find(
      (element) => element.position === position,
    );
    return place && place.name !== 'Unknown' ? `${place.name} (${position}m)` : `${position}m`;
  };

  return (
    <div className="margin-line">
      <div className="row">
        <div className="col-md-1">
          <small>{idx + 1}</small>
        </div>
        <div className="col-md-3">
          {position2name(data.begin_position)}
        </div>
        <div className="col-md-3">
          {position2name(data.end_position)}
        </div>
        <div className="col-md-2">
          {t(`marginTypes.${data.type}`)}
        </div>
        <div className="col-md-2">
          {data.value}
          {TYPEUNITS[data.type]}
        </div>
        <div className="col-md-1 d-flex">
          <button type="button" className="btn btn-sm btn-only-icon btn-white mr-1 ml-auto">
            <FaPencilAlt />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-only-icon btn-white text-danger"
            onClick={() => delMargin(idx)}
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Margins() {
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const [trainDetail, setTrainDetail] = useState(undefined);
  const [margins, setMargins] = useState([]);
  const [updateMargins, setUpdateMargins] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dispatch = useDispatch();
  const { t } = useTranslation(['margins']);

  const getMargins = async () => {
    try {
      setIsUpdating(true);
      const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
      setTrainDetail(result);
      setMargins(result.margins);
      setIsUpdating(false);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const changeMargins = async (newMargins) => {
    try {
      setIsUpdating(true);
      await put(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`, {
        ...trainDetail,
        margins: newMargins,
      });
      const newSimulationTrains = Array.from(simulation.trains);
      newSimulationTrains[selectedTrain] = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/result/`);

      getMargins();
      dispatch(updateSimulation({ ...simulation, trains: newSimulationTrains }));
      dispatch(updateMustRedraw(true));
      dispatch(setSuccess({
        title: t('marginModified'),
        text: 'Hop hop hop',
      }));
      setIsUpdating(false);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const delMargin = (idx) => {
    const newMargins = Array.from(margins);
    newMargins.splice(idx, 1);
    setMargins(newMargins);
    setUpdateMargins(true);
  };

  useEffect(() => {
    if (updateMargins) {
      changeMargins(margins);
      setUpdateMargins(false);
    }
  }, [margins]);

  useEffect(() => {
    getMargins();
  }, [selectedTrain]);

  return (
    <div className="osrd-simulation-container">
      {isUpdating && (
        <div className="margins-updating-loader">
          <DotsLoader />
        </div>
      )}
      <div className="row mb-1 small">
        <div className="col-md-1">
          n°
        </div>
        <div className="col-md-3 text-lowercase">
          {t('from')}
        </div>
        <div className="col-md-3">
          {t('to')}
        </div>
        <div className="col-md-4">
          {t('marginType')}
        </div>
      </div>
      {trainDetail && trainDetail.margins && trainDetail.margins.map((margin, idx) => (
        <Margin data={margin} delMargin={delMargin} idx={idx} key={nextId()} />
      ))}
      <hr className="mt-0" />
      <EmptyLine
        setMargins={setMargins}
        setUpdateMargins={setUpdateMargins}
        margins={margins}
      />
    </div>
  );
}

Margin.propTypes = {
  data: PropTypes.object.isRequired,
  delMargin: PropTypes.func.isRequired,
  idx: PropTypes.number.isRequired,
};

EmptyLine.propTypes = {
  margins: PropTypes.array,
  setMargins: PropTypes.func.isRequired,
  setUpdateMargins: PropTypes.func.isRequired,
};
EmptyLine.defaultProps = {
  margins: [],
};
