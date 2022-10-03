import React, { useState } from 'react';
import { IoMdEye, IoMdSearch } from 'react-icons/io';
import nextId from 'react-id-generator';
import { sec2time } from 'utils/timeManipulation';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

function formatStops(stop, idx, train) {
  return (
    <tr key={nextId()}>
      <td>
        <div className="cell-inner">{stop.duration > 0 ? `${stop.duration}s` : null}</div>
      </td>
      <td>
        <div className="cell-inner">{train.eco && sec2time(train.eco.stops[idx].time)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.duration > 0 && sec2time(stop.time + stop.duration)}</div>
      </td>
      <td>
        <div className="cell-inner font-weight-bold">{stop.name || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner">{sec2time(stop.time)}</div>
      </td>
      <td>
        <div className="cell-inner">
          {train.eco &&
            train.eco.stops[idx].duration > 0 &&
            sec2time(train.eco.stops[idx].time + train.eco.stops[idx].duration)}
        </div>
      </td>
    </tr>
  );
}

function originStops(stop, idx, train) {
  return (
    <div key={nextId()}>
    </div>
  );
}

export default function TrainSchedule() {
  const { t } = useTranslation(['rollingstock'],['simulation'],['map-search'],['osrdconf']);
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
          <div class="modal-content">
            <div className="modal-header">
              <button type="button" className="close" data-dismiss="modal">
                <span>&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <div class="d-flex bd-highlight">
                <div class="p-2 flex-fill bd-highlight border-right">
                  <div className="text-primary mb-5">1 - Description de sillon</div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>{t('osrdconf:origin')} :</h2>
                    <div className="text-primary">
                      {data.map((stop, idx) =>
                        originStops(stop, idx, simulation.trains[selectedTrain])
                      )}
                    </div>
                  </div>
                  <div class="p-2 mb-2 flex-fill border-bottom">
                    <h2>{t('osrdconf:destination')} :</h2>
                    <div className="text-primary ">Orléans</div>
                  </div>
                  <div class="p-2 flex-fill">
                    <h2>{t('osrdconf:rollingstock')} :</h2>
                    <div className="text-bold">22200</div>
                  </div>
                  <div class="p-2 flex-fill">
                    <h2>{t('rollingstock:weight')} :</h2>
                    <div className="text-bold">400T</div>
                  </div>
                  <div class="p-2 flex-fill">
                    <h2>{t('osrdconf:composition')} :</h2>
                    <div className="text-bold">V160</div>
                  </div>
                  <div class="p-2 flex-fill">
                    <h2>{t('osrdconf:speedLimitByTag')} :</h2>
                    <div className="text-bold">59U</div>
                  </div>
                </div>
                <div class="p-2 flex-fill">
                  <div className="text-primary  mb-5">2 - {t('simulation:timetable')}</div>
                  <div class="text-right">
                    <p class="font-italic text-cyan font-weight-normal">Nombre de lignes : 112</p>
                    <div className="table-wrapper simulation-trainschedule">
                      <table>
                        <thead class="bg-light">
                          <tr>
                            <th scope="col ">
                              <div className="text-primary">{t('map-search:placeholderline')}</div>
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
                        <tbody>
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
    </>
  );
}
