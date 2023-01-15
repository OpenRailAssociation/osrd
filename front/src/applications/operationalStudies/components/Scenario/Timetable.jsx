import React, { useEffect, useState } from 'react';
import { sec2time } from 'utils/timeManipulation';
import { updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation/actions';
import { useDispatch, useSelector } from 'react-redux';

import { IoMdEye } from 'react-icons/io';
import DriverTrainSchedule from 'applications/operationalStudies/views/OSRDSimulation/DriverTrainSchedule';
import { changeTrain } from 'applications/operationalStudies/components/TrainList/TrainListHelpers';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';

export default function Timetable() {
  const { selectedProjection, selectedTrain, departureArrivalTimes } = useSelector(
    (state) => state.osrdsimulation
  );
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const dispatch = useDispatch();
  const [formattedList, setFormattedList] = useState(null);
  const [trainNameClickedIDX, setTrainNameClickedIDX] = useState(undefined);
  const [typeOfInputFocused, setTypeOfInputFocused] = useState(undefined);
  const [dataDisplayModal, setDataDisplayModal] = useState(undefined);

  const { t } = useTranslation(['simulation']);

  const changeSelectedTrain = (idx, typeOfInputToFocus) => {
    dispatch(updateSelectedTrain(idx));
    setTrainNameClickedIDX(idx);
    setTypeOfInputFocused(typeOfInputToFocus);
    dispatch(updateMustRedraw(true));
  };

  const formatTrainsList = () =>
    departureArrivalTimes.map((train, idx) => (
      <tr className={selectedTrain === idx ? 'table-cell-selected' : null} key={nextId()}>
        <td>
          <div className="cell-inner">{train.id === selectedProjection.id && '🎢'}</div>
        </td>
        <td className="td-button"><div className="cell-inner">{train.name}</div></td>
        <td><div className="cell-inner">{sec2time(train.departure)}</div></td>
        <td>
          <div className="cell-inner">{sec2time(train.arrival)}</div>
        </td>
        <td>
          <div className="cell-inner">{train.labels && train.labels.join(' / ')}</div>
        </td>
        <td>
          <div className="cell-inner">{train.speed_limit_composition}</div>
        </td>
        <td>
          <div className="cell-inner">
            <button
              type="button"
              className="btn btn-only-icon btn-transparent btn-color-gray px-0"
              data-toggle="modal"
              data-target="#driverTrainScheduleModal"
              onClick={() => setDataDisplayModal(simulation.trains[idx])}
            >
              <IoMdEye />
            </button>
          </div>
        </td>
      </tr>
    ));

  useEffect(() => {
    setFormattedList(formatTrainsList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrain, departureArrivalTimes, trainNameClickedIDX, typeOfInputFocused]);

  return (
    <>
      <div className="table-wrapper simulation-trainlist">
        <div className="table-scroller dragscroll">
          <table className="table table-hover">
            <thead className="thead thead-light">
              <tr>
                <th scope="col" colSpan="2">
                  <div className="cell-inner">{t('simulation:name')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:start')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:stop')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:labels')}</div>
                </th>
                <th scope="col">
                  <div className="cell-inner">{t('simulation:speedLimitComposition')}</div>
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>{formattedList}</tbody>
          </table>
        </div>
      </div>
      <DriverTrainSchedule data={dataDisplayModal} />
    </>
  );
}
