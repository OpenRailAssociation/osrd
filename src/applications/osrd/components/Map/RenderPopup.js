import React from 'react';
import { Popup } from 'react-map-gl';
import { useSelector } from 'react-redux';
import bbox from '@turf/bbox';
import PopupInfos from 'common/Map/Popup/PopupInfos';
import PopupInfosCustomContent from 'applications/osrd/components/Map/PopupInfosCustomContent';
import PopupInfosCustomTitle from 'applications/osrd/components/Map/PopupInfosCustomTitle';
import convertLayerVariables from 'applications/osrd/components/Helpers/convertLayerVariables';

export default function RenderPopup() {
  const { featureInfoClick } = useSelector((state) => state.osrdconf);
  if (featureInfoClick.displayPopup) {
    const properties = convertLayerVariables(featureInfoClick.feature.properties);
    if (!properties.longueur) {
      properties.longueur = properties.pkLigneF - properties.pkLigneD;
    }
    let backgroundColor;
    switch (properties.typeVoie) {
      case 'VP':
        backgroundColor = properties.categVoie === 'VS' ? 'bg-danger' : 'bg-primary';
        break;
      default:
        backgroundColor = 'bg-secondary';
        break;
    }

    properties.source = featureInfoClick.feature.source;
    properties.clickLngLat = featureInfoClick.lngLat;
    properties.boundingBox = bbox(featureInfoClick.feature);
    /* eslint prefer-destructuring: ["error", {AssignmentExpression: {array: false}}] */
    /* eslint no-underscore-dangle: ["error", { "allow": ["_geometry"] }] */
    properties.startLonLat = featureInfoClick.feature._geometry.coordinates[0];
    properties.endLonLat =
      featureInfoClick.feature._geometry.coordinates[
        featureInfoClick.feature._geometry.coordinates.length - 1
      ];

    return (
      <Popup
        longitude={featureInfoClick.lngLat[0]}
        latitude={featureInfoClick.lngLat[1]}
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
