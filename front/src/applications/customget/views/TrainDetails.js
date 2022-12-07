import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateStickyBar } from 'reducers/osrdsimulation/actions';

export default function TrainDetails() {
  const { positionValues, stickyBar, timePosition } = useSelector((state) => state.osrdsimulation);
  const dispatch = useDispatch();

  const { t } = useTranslation(['simulation']);

  return (
    <div className="d-flex">
      {positionValues.headPosition && timePosition && stickyBar && (
        <>
          <div className="rounded px-1 train-detail small bg-blue text-white text-nowrap mr-1">
            <div className="font-weight-bold text-uppercase">{t('trainDetails.headPosition')}</div>
            {positionValues.headPosition && Math.round(positionValues.headPosition.position) / 1000}
            km
          </div>
          <div className="rounded px-1 train-detail small bg-pink text-white">
            <div className="font-weight-bold text-uppercase">{t('trainDetails.speed')}</div>
            {positionValues.speed && Math.round(positionValues.speed.speed)}
            km/h
          </div>
        </>
      )}
      <button
        className="btn btn-sm btn-only-icon btn-primary ml-auto"
        type="button"
        onClick={() => dispatch(updateStickyBar(false))}
      >
        <i className="icons-arrow-next" />
      </button>
    </div>
  );
}
