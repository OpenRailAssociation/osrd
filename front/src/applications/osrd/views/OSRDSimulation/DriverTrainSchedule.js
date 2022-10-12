import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { IoMdEye } from 'react-icons/io';
import nextId from 'react-id-generator';
import { sec2time } from 'utils/timeManipulation.js';
import { useTranslation } from 'react-i18next';
import RollingStockCard from '../../components/RollingStock/RollingStockCard';

function RollingStockInfo() {
  const [resultContent, setResultContent] = useState(undefined);
  const displayMateriel = (result) => <RollingStockCard data={result} key={result.id} />;

  return <div>{resultContent.map((result) => displayMateriel(result))}</div>;
}

function formatStops(stop, idx, train) {
  return (
    <tr key={nextId()} className={`${stop.duration > 0 ? 'font-weight-bold' : ''}`}>
      <td>
        <div className="cell-inner">{idx + 1}</div>
      </td>
      <td>
        <div className="cell-inner">{train.speeds || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner" id="origine">
          {Math.round(stop.position / 100) / 10}
        </div>
      </td>
      <td>
        <div className="cell-inner">{stop.name || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner">{sec2time(stop.time)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.trackname || 'Unknown'}</div>
      </td>
    </tr>
  );
}

function originStop(stop) {
  return <div className="text-primary">{stop.name || 'Unknown'}</div>;
}

export default function DriverTrainSchedule() {
  const { t } = useTranslation(['drivertrainschedule']);
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const data = simulation.trains[selectedTrain].base.stops;

  return (
    <>
      <button
        type="button"
        className="btn btn-only-icon btn-transparent btn-color-gray px-0"
        data-toggle="modal"
        data-target=".bd-modal-xl"
      >
        <IoMdEye />
      </button>
      <div className="modal fade bd-modal-xl">
        <div className="mx-auto mt-5 pt-5 modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" data-dismiss="modal">
                <span>&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="container">
                <div className="text-primary ml-2 mt-2">{t('drivertrainschedule:dcmdetails')}</div>
                <div className="row">
                  <div className="col py-3">
                    <div className="row ml-4">
                      <p className="font-weight-normal">{t('drivertrainschedule:origin')} :</p>
                    </div>
                    <div className="row ml-4">
                      <p className="font-weight-normal">{t('drivertrainschedule:destination')} :</p>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-n5">
                      <div className="text-primary">
                        {data.map((stop) => originStop(stop, simulation.trains[selectedTrain]))[0]}
                      </div>
                    </div>
                    <div className="row ml-n5">
                      <div className="text-primary">
                        {data
                          .map((stop) => originStop(stop, simulation.trains[selectedTrain]))
                          .slice(-1)}
                      </div>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-5">
                      <p className="font-weight-normal">
                        {t('drivertrainschedule:rollingstock')} :
                      </p>
                    </div>
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('drivertrainschedule:weight')} :</p>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-2">
                      <div className="text-bold">{}</div>
                    </div>
                    <div className="row ml-2">
                      <div className="text-bold">{Math.round(data.mass / 1000)}T</div>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-5">
                      <p className="font-weight-normal">
                        {t('drivertrainschedule:speedLimitByTag')} :
                      </p>
                    </div>
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('drivertrainschedule:composition')} :</p>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-2">
                      <div className="text-bold">59U</div>
                    </div>
                    <div className="row ml-2">
                      <div className="text-bold">V160</div>
                    </div>
                  </div>
                </div>
                <div className="text-primary ml-2 mt-5">{t('drivertrainschedule:timetable')}</div>
                <div className="text-right">
                  <p className="font-italic text-cyan font-weight-normal">
                    {t('drivertrainschedule:timetable')} : {data.length}
                  </p>
                  <div className="row">
                    <div className="table-wrapper simulation-drivertrainschedule">
                      <div className="table-scroller dragscroll">
                        <table className="table">
                          <thead className="bg-light">
                            <tr>
                              <th scope="col ">
                                <div className="text-primary">
                                  {t('drivertrainschedule:placeholderline')}
                                </div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">
                                  {t('drivertrainschedule:speedlimits')}
                                </div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('drivertrainschedule:pk')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('drivertrainschedule:place')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('drivertrainschedule:time')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">
                                  {t('drivertrainschedule:trackname')}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="font-weight-normal">
                            {data.map((stop, idx, train) =>
                              formatStops(stop, idx, train, simulation.trains[selectedTrain])
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
