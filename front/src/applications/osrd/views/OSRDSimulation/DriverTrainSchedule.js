import React, { useState } from 'react';
import { IoMdEye } from 'react-icons/io';
import nextId from 'react-id-generator';
import { sec2time } from 'utils/timeManipulation.js';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

function formatStops(stop, idx, train) {
  return (
    <tr key={nextId()} className={`${stop.duration > 0 ? 'font-weight-bold' : ''}`}>
      <td>
        <div className="cell-inner">{idx + 1}</div>
      </td>
      <td>
        <div className="cell-inner">{140}</div>
      </td>
      <td>
        <div className="cell-inner">{Math.round(stop.position / 100) / 10}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.name || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner">{sec2time(stop.time)}</div>
      </td>
      <td>
        <div className="cell-inner">A</div>
      </td>
    </tr>
  );
}

function dcmDetails(stop, idx, train) {
  return <div key={nextId()} />;
}

export default function DriverTrainSchedule() {
  const { t } = useTranslation(['rollingstock'], ['simulation'], ['map-search'], ['osrdconf']);
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
                <div className="text-primary ml-2 mt-2">Détails du sillon</div>
                <div className="row">
                  <div className="col py-3">
                    <div className="row ml-4">
                      <p className="font-weight-normal">{t('osrdconf:origin')} :</p>
                    </div>
                    <div className="row ml-4">
                      <p className="font-weight-normal">{t('osrdconf:destination')} :</p>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-n5">
                      <div className="text-primary">Paris</div>
                    </div>
                    <div className="row ml-n5">
                      <div className="text-primary">Orléans</div>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('osrdconf:rollingstock')} :</p>
                    </div>
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('rollingstock:weight')} :</p>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-2">
                      <div className="text-bold">22200</div>
                    </div>
                    <div className="row ml-2">
                      <div className="text-bold">400T</div>
                    </div>
                  </div>
                  <div className="col py-3">
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('osrdconf:speedLimitByTag')} :</p>
                    </div>
                    <div className="row ml-5">
                      <p className="font-weight-normal">{t('osrdconf:composition')} :</p>
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
                <div className="text-primary ml-2 mt-5">{t('simulation:timetable')}</div>
                <div className="text-right">
                  <p className="font-italic text-cyan font-weight-normal">
                    Nombre de lignes : {$('table th').length - 3}
                  </p>
                  <div className="row">
                    <div className="table-wrapper simulation-drivertrainschedule">
                      <div className="table-scroller dragscroll">
                        <table className="table" id="table">
                          <thead className="bg-light">
                            <tr>
                              <th scope="col ">
                                <div className="text-primary">
                                  {t('map-search:placeholderline')}
                                </div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('map-settings:speedlimits')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('map-search:pk')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('simulation:stopPlace')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('simulation:stopTime')}</div>
                              </th>
                              <th scope="col">
                                <div className="text-primary">{t('map-search:trackname')}</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="font-weight-normal">
                            {data.map((stop, idx) =>
                              formatStops(stop, idx, simulation.trains[selectedTrain])
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
