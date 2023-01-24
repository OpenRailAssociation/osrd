import React from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';

import { getFeatureInfoClick } from 'reducers/osrdconf/selectors';
import PopupInfos from 'common/Map/Popup/PopupInfos';
import PopupInfosCustomContent from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/PopupInfosCustomContent';
import PopupInfosCustomTitle from 'applications/operationalStudies/components/ManageTrainSchedule/ManageTrainScheduleMap/PopupInfosCustomTitle';

export default function RenderPopup() {
  const featureInfoClick = useSelector(getFeatureInfoClick);
  if (featureInfoClick.displayPopup) {
    let backgroundColor;
    switch (featureInfoClick.feature.properties.typeVoie) {
      case 'VP':
        backgroundColor =
          featureInfoClick.feature.properties.categVoie === 'VS' ? 'bg-danger' : 'bg-primary';
        break;
      default:
        backgroundColor = 'bg-secondary';
        break;
    }

    const properties = {
      ...featureInfoClick.feature.properties,
      source: featureInfoClick.feature.source,
      clickLngLat: [
        featureInfoClick.coordinates[0],
        featureInfoClick.coordinates[1],
      ]
    }

    return (
      <Popup
        longitude={featureInfoClick.coordinates[0]}
        latitude={featureInfoClick.coordinates[1]}
        closeButton={false}
        className="mapboxgl-hover-custom-popup"
      >
        <PopupInfos
          title={<PopupInfosCustomTitle properties={properties} />}
          content={<PopupInfosCustomContent data={properties} />}
          backgroundColor={backgroundColor}
        />
      </Popup>
    );
  }
  return null;
}
