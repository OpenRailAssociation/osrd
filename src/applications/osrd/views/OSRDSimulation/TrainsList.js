import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import nextId from 'react-id-generator';
import { useTranslation } from 'react-i18next';
import { sec2time } from 'utils/timeManipulation';
import { updateMustRedraw, updateSelectedTrain } from 'reducers/osrdsimulation';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';

export default function TrainsList() {
  const {
    selectedTrain, simulation,
  } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();
  const [formattedList, setFormattedList] = useState(undefined);
  const [filter, setFilter] = useState('');

  const { t } = useTranslation(['simulation']);

  const changeSelectedTrain = (idx) => {
    dispatch(updateMustRedraw(true));
    dispatch(updateSelectedTrain(idx));
  };

  const formatTrainsList = () => {
    const newFormattedList = simulation.trains.map((train, idx) => {
      if (filter === '' || (train.labels !== undefined && train.labels.join().toLowerCase().includes(filter.toLowerCase()))) {
        return (
          <tr
            className={selectedTrain === idx ? 'table-cell-selected' : null}
            key={nextId()}
          >
            <td>
              <div className="cell-inner">
                <div className="custom-control custom-checkbox custom-checkbox-alone">
                  <input type="checkbox" className="custom-control-input" id={`timetable-train-${idx}`} />
                  <label className="custom-control-label" htmlFor={`timetable-train-${idx}`} />
                </div>
              </div>
            </td>
            <td className="td-button">
              <div
                className="cell-inner cell-inner-button"
                role="button"
                onClick={() => changeSelectedTrain(idx)}
                tabIndex={0}
              >
                {train.name}
              </div>
            </td>
            <td><div className="cell-inner">{sec2time(train.stops[0].time)}</div></td>
            <td><div className="cell-inner">{sec2time(train.stops[train.stops.length - 1].time)}</div></td>
            <td><div className="cell-inner">{train.labels.join(' / ')}</div></td>
          </tr>
        );
      }
      return null;
    });
    return newFormattedList;
  };

  useEffect(() => {
    setFormattedList(formatTrainsList());
  }, [selectedTrain, simulation, filter]);

  return (
    <>
      <div className="mb-2 row">
        <div className="col-md-6 col-4">
          <span className="h2 flex-grow-2">{t('simulation:trainList')}</span>
        </div>
        <div className="col-md-6 col-8">
          <InputSNCF
            type="text"
            placeholder={t('simulation:placeholderlabel')}
            id="labels-filter"
            onChange={(e) => setFilter(e.target.value)}
            onClear={() => setFilter('')}
            value={filter}
            clearButton
            noMargin
            sm
          />
        </div>
      </div>
      <div className="table-wrapper simulation-trainlist">
        <div className="table-scroller dragscroll">
          <table className="table table-hover">
            <thead className="thead thead-light">
              <tr>
                <th>
                  <div className="cell-inner">
                    <div className="custom-control custom-checkbox custom-checkbox-alone">
                      <input type="checkbox" className="custom-control-input" id="timetable-sel-all-trains" />
                      <label className="custom-control-label" htmlFor="timetable-sel-all-trains" />
                    </div>
                  </div>
                </th>
                <th scope="col"><div className="cell-inner">{t('simulation:name')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:start')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:stop')}</div></th>
                <th scope="col"><div className="cell-inner">{t('simulation:labels')}</div></th>
              </tr>
            </thead>
            <tbody>
              {formattedList !== undefined ? formattedList : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
