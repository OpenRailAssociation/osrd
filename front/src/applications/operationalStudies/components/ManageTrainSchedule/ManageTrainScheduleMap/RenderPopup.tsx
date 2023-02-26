import React from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { getFeatureInfoClick } from 'reducers/osrdconf/selectors';
import { RiMapPin2Fill, RiMapPin3Fill, RiMapPin5Fill } from 'react-icons/ri';
import setPointIti from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/setPointIti';
import { useTranslation } from 'react-i18next';

export default function RenderPopup() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const featureInfoClick = useSelector(getFeatureInfoClick);

  if (
    featureInfoClick.displayPopup &&
    featureInfoClick.feature &&
    featureInfoClick.feature.properties &&
    featureInfoClick.coordinates
  ) {
    const properties = {
      ...featureInfoClick.feature.properties,
      clickLngLat: featureInfoClick.coordinates.slice(0, 2),
    };

    return (
      <Popup
        longitude={featureInfoClick.coordinates[0]}
        latitude={featureInfoClick.coordinates[1]}
        closeButton={false}
        className="map-hover-custom-popup"
      >
        <button
          className="btn btn-sm btn-success"
          type="button"
          onClick={() => setPointIti('start', properties)}
        >
          <RiMapPin2Fill />
          <span className="d-none">{t('origin')}</span>
        </button>
        <button
          className="btn btn-sm btn-info"
          type="button"
          onClick={() => setPointIti('via', properties)}
        >
          <RiMapPin3Fill />
          <span className="d-none">{t('via')}</span>
        </button>
        <button
          className="btn btn-sm btn-warning"
          type="button"
          onClick={() => setPointIti('end', properties)}
        >
          <RiMapPin5Fill />
          <span className="d-none">{t('destination')}</span>
        </button>
      </Popup>
    );
  }
  return null;
}
