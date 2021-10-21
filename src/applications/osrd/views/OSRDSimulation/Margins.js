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

const EmptyLine = (props) => {
  const { setMargins, setValues, values } = props;
  const { t } = useTranslation(['margins']);

  const marginTypes = [
    {
      id: 'construction',
      label: t('marginTypes.construction'),
      unit: 's',
    },
    {
      id: 'ratio_time',
      label: t('marginTypes.ratio_time'),
      unit: '%',
    },
    {
      id: 'ratio_distance',
      label: t('marginTypes.ratio_distance'),
      unit: 'm/10km',
    },
  ];

  const handleType = (type) => {
    setValues({
      ...values,
      type: type.type,
      value: parseInt(type.value, 10),
    });
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
          onClick={() => setMargins(values)}
        >
          <i className="icons-add" />
        </button>
      </div>
    </div>
  );
};

const Margin = (props) => {
  const { data } = props;
  return (
    <>
      <div className="">{data.type}</div>
    </>
  );
};

export default function Margins() {
  const { selectedTrain, simulation } = useSelector((state) => state.osrdsimulation);
  const [values, setValues] = useState(marginNewDatas);
  const [trainDetail, setTrainDetail] = useState(undefined);
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const getMargins = async () => {
    try {
      const result = await get(`${trainscheduleURI}${simulation.trains[selectedTrain].id}/`);
      setTrainDetail(result);
      console.log(result);
    } catch (e) {
      console.log('ERROR', e);
      dispatch(setFailure({
        name: e.name,
        message: e.message,
      }));
    }
  };

  const setMargins = async (margin) => {
    try {
      const newMargins = trainDetail.margins
        ? Array.from(trainDetail.margins).push(margin) : [margin];
    console.log({
    ...trainDetail,
    margins: newMargins,
    });
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

  useEffect(() => {
    getMargins();
  }, [selectedTrain]);

  return (
    <div className="osrd-simulation-container">
      {trainDetail && trainDetail.margins && trainDetail.margins.map((margin) => (
        <Margin data={margin} key={nextId()} />
      ))}
      <EmptyLine setValues={setValues} values={values} setMargins={setMargins} />
    </div>
  );
}

Margin.propTypes = {
  data: PropTypes.object.isRequired,
};

EmptyLine.propTypes = {
  setValues: PropTypes.func.isRequired,
  values: PropTypes.object.isRequired,
};
