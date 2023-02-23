import React from 'react';
import PropTypes from 'prop-types';
import { Position } from 'geojson';
import cx from 'classnames';

import Pathfinding from 'common/Pathfinding';
import Origin from './Origin';
import Vias from './Vias';
import Destination from './Destination';

// Interfaces
import { PointOnMap } from 'applications/operationalStudies/consts';

interface DisplayItineraryProps {
  zoomToFeaturePoint: (lngLat?: Position, id?: string, source?: string) => void;
  zoomToFeature: (lngLat: Position, id?: undefined, source?: undefined) => void;
  viaModalContent: string;
  origin: PointOnMap;
  destination: PointOnMap;
  vias: PointOnMap[];
}

export default function DisplayItinerary(props: DisplayItineraryProps) {
  const { zoomToFeaturePoint, zoomToFeature, viaModalContent, origin, destination, vias } = props;

  return (
    <div
      className={cx({
        'osrd-config-anchor': !origin && !destination && vias.length < 1,
      })}
    >
      <Origin data-testid="itinerary-origin" zoomToFeaturePoint={zoomToFeaturePoint} />
      <Vias
        data-testid="itinerary-vias"
        zoomToFeaturePoint={zoomToFeaturePoint}
        viaModalContent={viaModalContent}
      />
      <Destination data-testid="itinerary-destination" zoomToFeaturePoint={zoomToFeaturePoint} />

      <Pathfinding zoomToFeature={zoomToFeature} />
    </div>
  );
}

DisplayItinerary.propTypes = {
  zoomToFeaturePoint: PropTypes.func.isRequired,
  zoomToFeature: PropTypes.func.isRequired,
  viaModalContent: PropTypes.string,
  origin: PropTypes.object,
  destination: PropTypes.object,
  vias: PropTypes.array,
};

DisplayItinerary.defaultProps = {
  zoomToFeaturePoint: () => {},
  zoomToFeature: () => {},
  viaModalContent: '',
  origin: {},
  destination: {},
  vias: [],
};
