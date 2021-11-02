import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import { useSelector, useDispatch } from 'react-redux';
import { get, put } from 'common/requests';
import { setFailure, setSuccess } from 'reducers/main.ts';
import { updateSimulation, updateMustRedraw } from 'reducers/osrdsimulation';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';

const trainscheduleURI = '/train_schedule/';

const marginNewDatas = {
  type: 'construction',
  begin_position: 0,
  end_position: 0,
  value: 0,
};

/* Alors construction c'est juste un temps em s.
  ratio_time c'est un ratio donc un pourcentage.
  ratio_distance c'est en metre pour 10km
  Le begin_position et end_position c'est en metres
*/
const TYPEUNITS = {
  construction: 's',
  ratio_time: '%',
  ratio_distance: 'm/10km',
};

const EmptyLine = (props) => {
  const { margins, setMargins, setUpdateMargins } = props;
  const [values, setValues] = useState(marginNewDatas);
  const { t } = useTranslation(['margins']);

  const marginTypes = [
    {
      id: 'construction',
      label: t('marginTypes.construction'),
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
      value: parseInt(type.value, 10),
    });
  };

  const addMargins = (margin) => {
    const newMargins = margins.length > 0
      ? Array.from(margins).push(margin) : [margin];
    setMargins(newMargins);
    setUpdateMargins(true);
  };

  return (
    <div className="row">
      <div className="col-md-2 d-flex align-items-center">
        <span className="mr-1">{t('from')}</span>
        <InputSNCF
          type="number"
          onChange={(e) => setValues({ ...values, begin_position: parseInt(e.target.value, 10) })}
          value={values.begin_position}
          placeholder={t('begin_position')}
          unit="m"
          noMargin
          sm
        />
      </div>
      <div className="col-md-2 d-flex align-items-center">
        <span className="mr-1">{t('to')}</span>
        <InputSNCF
          type="number"
          onChange={(e) => setValues({ ...values, end_position: parseInt(e.target.value, 10) })}
          value={values.end_position}
          placeholder={t('end_position')}
          unit="m"
          noMargin
          sm
        />
      </div>
      <div className="col-md-3">
        <InputGroupSNCF
          id="marginTypeSelect"
          options={marginTypes}
          handleType={handleType}
          value={parseInt(values.value, 10)}
          sm
        />
      </div>
      <div className="col-md-3">
        <button
          type="button"
          className="btn btn-success btn-sm"
          onClick={() => addMargins(values)}
        >
          <i className="icons-add" />
        </button>
      </div>
    </div>
  );
};

const Margin = (props) => {
  const { data, delMargin, idx } = props;
  const { t } = useTranslation(['margins']);
  return (
    <div className="margin-line">
      <div className="row">
        <div className="col-md-1">
          <small>{idx + 1}</small>
        </div>
        <div className="col-md-2">
          {data.begin_position}
          m
        </div>
        <div className="col-md-2">
          {data.end_position}
          m
        </div>
        <div className="col-md-2">
          {t(`marginTypes.${data.type}`)}
        </div>
        <div className="col-md-2">
          {data.value}
          {TYPEUNITS[data.type]}
        </div>
        <div className="col-md-3 d-flex">
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
  const dispatch = useDispatch();
  const { t } = useTranslation(['margins']);

  const getMargins = async () => {
    try {
      const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
      setTrainDetail(result);
      setMargins(result.margins);
      console.log(result);
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
        title: t('marginAdded'),
        text: 'Hop hop hop',
      }));
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const delMargin = (idx) => {
    const newMargins = Array.from(trainDetail.margins);
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
      <div className="row mb-1 small">
        <div className="col-md-1">
          n°
        </div>
        <div className="col-md-2 text-lowercase">
          {t('from')}
        </div>
        <div className="col-md-2">
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
