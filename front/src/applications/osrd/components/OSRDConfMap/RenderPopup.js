import React from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';
import PopupInfos from 'common/Map/Popup/PopupInfos';
import PopupInfosCustomContent from 'applications/osrd/components/OSRDConfMap/PopupInfosCustomContent';
import PopupInfosCustomTitle from 'applications/osrd/components/OSRDConfMap/PopupInfosCustomTitle';

export default function RenderPopup() {
  const { featureInfoClick } = useSelector((state) => state.osrdconf);
  console.log(featureInfoClick);
  if (featureInfoClick.displayPopup) {
    let backgroundColor;
    switch (featureInfoClick.feature.properties.typeVoie) {
      case 'VP':
        backgroundColor = featureInfoClick.feature.properties.categVoie === 'VS' ? 'bg-danger' : 'bg-primary';
        break;
      default:
        backgroundColor = 'bg-secondary';
        break;
    }

    featureInfoClick.feature.properties.source = featureInfoClick.feature.source;
    featureInfoClick.feature.properties.clickLngLat = featureInfoClick.lngLat;

    return (
      <Popup
        longitude={featureInfoClick.lngLat[0]}
        latitude={featureInfoClick.lngLat[1]}
        closeButton={false}
        className="mapboxgl-hover-custom-popup"
      >
        <PopupInfos
          title={<PopupInfosCustomTitle properties={featureInfoClick.feature.properties} />}
          content={<PopupInfosCustomContent data={featureInfoClick.feature.properties} />}
          backgroundColor={backgroundColor}
        />
      </Popup>
    );
  }
  return null;
}
