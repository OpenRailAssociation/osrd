import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

export default function TrainDetails() {
  const { positionValues, timePosition } = useSelector((state) => state.osrdsimulation);

  const { t } = useTranslation(['simulation']);

  return positionValues.routeEndOccupancy ? (
    <>
      { timePosition
        ? (
          <div className="row">
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-blue text-white text-nowrap">
                <div className="font-weight-bold mr-1">TÊTE</div>
                {positionValues.headPosition
                  && Math.round(positionValues.headPosition.position) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-cyan text-white text-nowrap">
                <div className="font-weight-bold mr-1">QUEUE</div>
                {positionValues.tailPosition
                  && Math.round(positionValues.tailPosition.position) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-red text-white text-nowrap">
                <div className="font-weight-bold mr-1">FIN CANTON</div>
                {Math.round(
                  positionValues.routeEndOccupancy.position,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-yellow text-black text-nowrap">
                <div className="font-weight-bold mr-1">DÉBUT CANTON</div>
                {Math.round(
                  positionValues.routeBeginOccupancy.position,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-secondary text-white text-nowrap">
                <div className="font-weight-bold mr-1">TAILLE CANTON</div>
                {Math.round(
                  positionValues.routeEndOccupancy.position
                  - positionValues.routeBeginOccupancy.position,
                ) / 1000}
                km
              </div>
            </div>
            <div className="col-md-2">
              <div className="rounded px-2 h-100 py-1 mb-1 small bg-pink text-white">
                <div className="font-weight-bold mr-1">VITESSE</div>
                {positionValues.speed && Math.round(positionValues.speed.speed)}
                km/h
              </div>
            </div>
          </div>
        ) : null }
    </>
  ) : null;
}
