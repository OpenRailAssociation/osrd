/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { getFeatureInfoClick } from 'reducers/osrdconf/selectors';
import { RiMapPin2Fill, RiMapPin3Fill } from 'react-icons/ri';
import setPointIti from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/setPointIti';
import { useTranslation } from 'react-i18next';
import { IoFlag } from 'react-icons/io5';

type FeatureInfoClickType = {
  displayPopup: boolean;
  coordinates?: number[];
  feature?: any;
};

function RenderPopup() {
  const { t } = useTranslation(['operationalStudies/manageTrainSchedule']);
  const featureInfoClick: FeatureInfoClickType = useSelector(getFeatureInfoClick);

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
        closeOnClick={false}
        className="map-popup-click-select"
      >
        <div className="details">
          <div className="details-track">
            {featureInfoClick.feature.properties.extensions_sncf_track_name}
            <small>{featureInfoClick.feature.properties.extensions_sncf_line_code}</small>
          </div>
          <div className="details-line">
            {featureInfoClick.feature.properties.extensions_sncf_line_name}
          </div>
        </div>
        <div className="actions">
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
            <IoFlag />
            <span className="d-none">{t('destination')}</span>
          </button>
        </div>
      </Popup>
    );
  }
  return null;
}

export default React.memo(RenderPopup);
