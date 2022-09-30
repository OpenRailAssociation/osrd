import React, { useState } from 'react';
import { IoMdEye } from 'react-icons/io';
import nextId from 'react-id-generator';
import { sec2time } from 'utils/timeManipulation';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

function formatStops(stop, idx, train) {
  return (
    <tr key={nextId()}>
      <td>
        <div className="cell-inner font-weight-bold">{stop.name || 'Unknown'}</div>
      </td>
      <td>
        <div className="cell-inner">{sec2time(stop.time)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.duration > 0 && sec2time(stop.time + stop.duration)}</div>
      </td>
      <td>
        <div className="cell-inner">{stop.duration > 0 ? `${stop.duration}s` : null}</div>
      </td>
      <td>
        <div className="cell-inner">{train.eco && sec2time(train.eco.stops[idx].time)}</div>
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

export default function TrainSchedule() {
  const { t } = useTranslation(['simulation']);
  const { selectedTrain } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const data = simulation.trains[selectedTrain].base.stops;

  return (
    <>
      <button
        type="button"
        className="btn btn-only-icon btn-transparent btn-color-gray px-0"
        data-toggle="modal"
        data-target=".bd-example-modal-xl"
      >
        <IoMdEye />
      </button>
      <div
        className="modal fade bd-example-modal-xl"
        tabindex="-1"
        role="dialog"
        aria-labelledby="myLargeModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-xl">
          <div class="modal-content">
            <div className="modal-header">
              <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <div class="d-flex bd-highlight">
                <div class="p-2 flex-fill bd-highlight">
                  <div className="text-primary">1 - Description de sillon</div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>Origine :</h2>
                    <div className="text-primary">Paris Montparnasse</div>
                  </div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>Destination :</h2>
                    <div className="text-primary">Orléans</div>
                  </div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>EM de trace :</h2>
                    <div className="text-bold">22200</div>
                  </div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>Masse de trace :</h2>
                    <div className="text-bold">400T</div>
                  </div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>Indice de composition :</h2>
                    <div className="text-bold">V160</div>
                  </div>
                  <div class="p-2 flex-fill bd-highlight">
                    <h2>Catégorie statistique :</h2>
                    <div className="text-bold">59U</div>
                  </div>
                </div>
                <div class="p-2 flex-fill bd-highlight">
                  <div className="text-primary">{t('simulation:timetable')}</div>
                  <div class="text-right"> 
                  <p class="font-italic">Nombre de lignes : 112</p>
                    <div>
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">
                              <div className="text-primary">N°</div>
                            </th>
                            <th scope="col">
                              <div className="text-primary">Vitesse Limite</div>
                            </th>
                            <th scope="col">
                              <div className="text-primary">PK</div>
                            </th>
                            <th scope="col">
                              <div className="text-primary">{t('simulation:stopPlace')}</div>
                            </th>
                            <th scope="col">
                              <div className="text-primary">{t('simulation:stopTime')}</div>
                            </th>
                            <th scope="col">
                              <div className="text-primary">Voie</div>
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-dismiss="modal">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
